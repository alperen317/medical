"use server"

import { revalidatePath } from "next/cache"
import { differenceInYears } from "date-fns"
import { prisma } from "@/lib/prisma"
import { verifySession } from "@/lib/dal"
import { can } from "@/lib/permissions"
import { logActivity } from "@/lib/db/activity"
import { getPatientById } from "@/lib/db/patients"
import {
  generatePatientSummary,
  prepareSummaryInput,
  type LabSnapshot,
  type PatientClinicalContext,
} from "@/lib/ai/clinical-assistant"
import type { LabValue } from "@/lib/ai/lab-report"
import { formatIcdEntry } from "@/lib/icd/format"

export type AiSummaryState = {
  success?: boolean
  message?: string
}

export type PreparedSummary =
  | { success: true; payload: string }
  | { success: false; message: string }

type PatientWithRelations = NonNullable<Awaited<ReturnType<typeof getPatientById>>>

// timelineEvents.metadata (Json) içinden lab değerlerini güvenle ayıklar.
function extractLabSnapshots(patient: PatientWithRelations): LabSnapshot[] {
  const snapshots: LabSnapshot[] = []
  for (const ev of patient.timelineEvents) {
    if (ev.type !== "document") continue
    const meta = ev.metadata as { documentType?: string; extractedValues?: unknown } | null
    const values = meta?.extractedValues
    if (!Array.isArray(values) || values.length === 0) continue
    snapshots.push({
      date: ev.date,
      documentType: typeof meta?.documentType === "string" ? meta.documentType : "belge",
      values: values as LabValue[],
    })
  }
  return snapshots
}

function buildContext(patient: PatientWithRelations): PatientClinicalContext {
  return {
    age: patient.dateOfBirth ? differenceInYears(new Date(), new Date(patient.dateOfBirth)) : undefined,
    sex: patient.gender === "male" ? "M" : patient.gender === "female" ? "F" : undefined,
    chronicConditions: patient.chronicConditions,
    allergies: patient.allergies,
    activeMedications: patient.prescriptions
      .filter((p) => p.active)
      .map((p) => `${p.medication} ${p.dosage} ${p.frequency}`.trim()),
    labHistory: extractLabSnapshots(patient),
  }
}

/**
 * LLM'e gönderilecek veriyi (payload) LLM'i çağırmadan hazırlar — önizleme/onay
 * adımı için. `patient:update` yetkisi gerekir.
 */
export async function preparePatientSummaryAction(patientId: string): Promise<PreparedSummary> {
  const user = await verifySession()
  if (!can(user.permissions, "patient:update")) {
    return { success: false, message: "Bu işlem için yetkiniz yok." }
  }

  const patient = await getPatientById(patientId)
  if (!patient) return { success: false, message: "Hasta bulunamadı." }

  const { payload } = prepareSummaryInput(buildContext(patient))
  return { success: true, payload }
}

/**
 * Hasta düzeyi klinik özet üretir ve Patient'a kalıcı olarak yazar (cache).
 * `payloadOverride` = kullanıcının önizlemede onayladığı/düzenlediği metin.
 * `patient:update` yetkisi gerekir.
 */
export async function generatePatientSummaryAction(
  patientId: string,
  payloadOverride?: string,
): Promise<AiSummaryState> {
  const user = await verifySession()
  if (!can(user.permissions, "patient:update")) {
    return { success: false, message: "Bu işlem için yetkiniz yok." }
  }

  const patient = await getPatientById(patientId)
  if (!patient) return { success: false, message: "Hasta bulunamadı." }

  let result
  try {
    result = await generatePatientSummary(buildContext(patient), { payloadOverride })
  } catch (err) {
    console.error("[ai-summary] generation failed:", err)
    return { success: false, message: "Klinik özet oluşturulamadı. Lütfen tekrar deneyin." }
  }

  await prisma.patient.update({
    where: { id: patientId },
    data: {
      aiSummary: result.summary || null,
      aiSummaryData: JSON.parse(JSON.stringify({
        systemPrompt: result.systemPrompt,
        prompt: result.prompt,
        trends: result.trends,
        interactions: result.interactions,
        suggestedIcd: result.suggestedIcd,
        model: result.model,
        generatedAt: result.generatedAt,
      })),
      aiSummaryAt: new Date(),
      aiSummaryById: user.userId,
    },
  })

  void logActivity({
    actorId: user.userId,
    action: "patient.ai_summary_generated",
    entityType: "patient",
    entityId: patientId,
    entityLabel: `${patient.firstName} ${patient.lastName}`,
    metadata: {
      model: result.model,
      trendCount: result.trends.length,
      interactionCount: result.interactions.length,
      suggestedIcdCount: result.suggestedIcd.length,
      hasSummary: Boolean(result.summary),
    },
  }).catch(console.error)

  revalidatePath(`/patients/${patientId}`)
  return { success: true }
}

/**
 * AI'ın önerdiği bir ICD-11 tanısını hastanın kronik hastalıklarına ekler.
 * `patient:update` yetkisi gerekir.
 */
export async function applyIcdSuggestionAction(
  patientId: string,
  entry: { code: string; title: string },
): Promise<AiSummaryState> {
  const user = await verifySession()
  if (!can(user.permissions, "patient:update")) {
    return { success: false, message: "Bu işlem için yetkiniz yok." }
  }

  if (!entry?.code) return { success: false, message: "Geçersiz ICD girişi." }

  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { firstName: true, lastName: true, chronicConditions: true },
  })
  if (!patient) return { success: false, message: "Hasta bulunamadı." }

  const formatted = formatIcdEntry(entry)
  if (patient.chronicConditions.includes(formatted)) {
    return { success: true } // zaten ekli
  }

  await prisma.patient.update({
    where: { id: patientId },
    data: { chronicConditions: [...patient.chronicConditions, formatted] },
  })

  void logActivity({
    actorId: user.userId,
    action: "patient.icd_added",
    entityType: "patient",
    entityId: patientId,
    entityLabel: `${patient.firstName} ${patient.lastName}`,
    metadata: { code: entry.code, title: entry.title, source: "ai_suggestion" },
  }).catch(console.error)

  revalidatePath(`/patients/${patientId}`)
  return { success: true }
}

/**
 * Kullanıcının bir klinik özet çıktısına verdiği geri bildirimi (👍 = 1, 👎 = -1
 * + opsiyonel not) kaydeder. LLM'e gönderilen istem ve üretilen sonuç, o hastanın
 * saklı özet verisinden alınarak puanla birlikte AiReportRating'e yazılır.
 */
export type RateSummaryInput = {
  rating: number
  comment?: string
  correctedResult?: string
  reasons?: string[]
}

export async function rateSummaryAction(
  patientId: string,
  input: RateSummaryInput,
): Promise<AiSummaryState> {
  const user = await verifySession()
  if (input.rating !== 1 && input.rating !== -1) {
    return { success: false, message: "Geçersiz puan." }
  }

  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { firstName: true, lastName: true, aiSummary: true, aiSummaryData: true },
  })
  if (!patient) return { success: false, message: "Hasta bulunamadı." }
  if (!patient.aiSummary) return { success: false, message: "Puanlanacak bir klinik özet yok." }

  const data = (patient.aiSummaryData ?? {}) as { systemPrompt?: string; prompt?: string; model?: string }

  await prisma.aiReportRating.create({
    data: {
      source: "patient_summary",
      patientId,
      systemPrompt: data.systemPrompt ?? null,
      prompt: data.prompt ?? "",
      result: patient.aiSummary,
      rating: input.rating,
      comment: input.comment?.trim() || null,
      correctedResult: input.correctedResult?.trim() || null,
      reasons: input.reasons ?? [],
      model: data.model ?? null,
      ratedById: user.userId,
    },
  })

  void logActivity({
    actorId: user.userId,
    action: "ai.report_rated",
    entityType: "patient",
    entityId: patientId,
    entityLabel: `${patient.firstName} ${patient.lastName}`,
    metadata: {
      source: "patient_summary",
      rating: input.rating,
      hasComment: Boolean(input.comment?.trim()),
      hasCorrection: Boolean(input.correctedResult?.trim()),
      reasons: input.reasons ?? [],
    },
  }).catch(console.error)

  return { success: true }
}
