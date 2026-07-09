"use server"

import path from "path"
import fs from "fs/promises"
import { prisma } from "@/lib/prisma"
import { verifySession, requirePermission } from "@/lib/dal"
import { z } from "zod/v4"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { logActivity } from "@/lib/db/activity"
import { getRuleConditionsMap } from "@/lib/db/clinicalos-intake"
import { resolveActionableNode } from "@/lib/workflow/engine"
import { isChecklistSatisfied } from "@/lib/workflow/document-checklist"
import type { WorkflowGraph } from "@/lib/workflow/types"

const UPLOAD_DIR = path.join(process.cwd(), "uploads")

// Kimlik Bilgileri formundaki "Cinsiyet" select'i Türkçe etiketleri değer
// olarak kullanır (bkz. prisma/seed-clinicalos.ts) — PatientV2.gender enum'ına
// yazarken burada eşleniyor.
const GENDER_LABEL_TO_ENUM: Record<string, "male" | "female" | "other"> = {
  Erkek: "male",
  Kadın: "female",
  Diğer: "other",
}

// Son Kontrol tamamlanıp "end" node'una ulaşıldığında ("hasta doktora hazır")
// ClinicalOS'un kendi PatientV2 kaydından, ana /patients modülünde kullanılan
// gerçek Patient kaydı otomatik oluşturulur — manuel "yeni hasta" girişine
// gerek kalmaz. Aynı TC kimlik no'suyla zaten bir Patient varsa (dönen hasta,
// yeni bir kabul süreci) tekrar oluşturulmaz, sadece bu kabul süreci o mevcut
// hastaya bağlanır (promotedPatientId) — /patients sayfasında Son Kontrol
// özetinin birebir gösterilebilmesi için bu bağlantı her iki durumda da kurulur.
// Bu adım başarısız olsa bile kabul sürecinin kendisi geri alınmaz — hata
// sadece loglanır, kullanıcı akışı bloklanmaz.
async function promotePatientFromIntake(instanceId: string, patientId: string, actorId: string) {
  try {
    const patientV2 = await prisma.patientV2.findUnique({ where: { id: patientId } })
    if (!patientV2) return

    let patient = patientV2.tcNo
      ? await prisma.patient.findUnique({ where: { tcNo: patientV2.tcNo } })
      : null
    let created = false

    if (!patient) {
      patient = await prisma.patient.create({
        data: {
          tcNo: patientV2.tcNo,
          firstName: patientV2.firstName,
          lastName: patientV2.lastName,
          dateOfBirth: patientV2.dateOfBirth,
          gender: patientV2.gender,
          phone: patientV2.phone,
          email: patientV2.email,
          allergies: [],
          chronicConditions: [],
        },
      })
      created = true
    }

    await prisma.workflowInstance.update({
      where: { id: instanceId },
      data: { promotedPatientId: patient.id },
    })

    if (created) {
      revalidatePath("/patients")
      void logActivity({
        actorId,
        action: "patient.create",
        entityType: "patient",
        entityId: patient.id,
        entityLabel: `${patient.firstName} ${patient.lastName}`,
        metadata: { source: "clinicalos_intake", workflowInstanceId: instanceId },
      }).catch(console.error)
    }
  } catch (err) {
    console.error("[clinicalos] hasta kaydı oluşturulamadı:", err)
  }
}

export type ActionState = {
  errors?: Record<string, string[]>
  message?: string
  success?: boolean
}

const StartIntakeSchema = z.object({
  workflowDefId: z.string().min(1, "Workflow seçilmeli"),
})

export async function startIntakeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const currentUser = await verifySession()
  requirePermission(currentUser, "intake:execute")

  const result = StartIntakeSchema.safeParse({
    workflowDefId: formData.get("workflowDefId"),
  })
  if (!result.success) return { errors: result.error.flatten().fieldErrors }

  const workflowDef = await prisma.workflowDefinition.findUnique({ where: { id: result.data.workflowDefId } })
  if (!workflowDef || workflowDef.status !== "published") {
    return { message: "Geçersiz veya yayınlanmamış workflow." }
  }

  const graph = (workflowDef.nodes as unknown as WorkflowGraph).nodes
  const startNode = graph.find((n) => n.type === "start")
  if (!startNode) return { message: "Workflow'da start node bulunamadı." }

  // Kimlik bilgileri artık bu modalde toplanmıyor — workflow'un ilk adımı olan
  // Kimlik Bilgileri formu doldurulduğunda submitFormAnswerAction bu placeholder
  // kaydı gerçek bilgilerle günceller (bkz. IDENTITY_FIELD_KEYS senkronizasyonu).
  const patient = await prisma.patientV2.create({
    data: {
      firstName: "Yeni",
      lastName: "Hasta",
      dateOfBirth: new Date(),
      gender: "other",
      phone: "",
    },
  })

  const rulesMap = await getRuleConditionsMap()
  const actionable = resolveActionableNode(startNode.id, graph, {}, {
    getRuleCondition: (id) => rulesMap.get(id),
  })

  const instance = await prisma.workflowInstance.create({
    data: {
      patientId: patient.id,
      workflowDefId: workflowDef.id,
      workflowVersion: workflowDef.version,
      currentNodeId: actionable.id,
      status: actionable.type === "end" ? "completed" : "in_progress",
      completedAt: actionable.type === "end" ? new Date() : null,
      answers: {},
      history: [],
    },
  })

  revalidatePath("/clinicalos/intake")
  void logActivity({
    actorId: currentUser.userId,
    action: "intake.start",
    entityType: "workflow_instance",
    entityId: instance.id,
    entityLabel: `${patient.firstName} ${patient.lastName}`,
    metadata: { workflowDefId: workflowDef.id, workflowName: workflowDef.name },
  }).catch(console.error)

  redirect(`/clinicalos/intake/${instance.id}`)
}

export async function submitFormAnswerAction(
  instanceId: string,
  values: Record<string, unknown>,
): Promise<ActionState> {
  const currentUser = await verifySession()
  requirePermission(currentUser, "intake:execute")

  const instance = await prisma.workflowInstance.findUnique({
    where: { id: instanceId },
    include: { workflowDef: true },
  })
  if (!instance) return { message: "Kabul kaydı bulunamadı." }

  const graph = (instance.workflowDef.nodes as unknown as WorkflowGraph).nodes
  const currentNode = graph.find((n) => n.id === instance.currentNodeId)
  if (!currentNode || currentNode.type !== "form" || !currentNode.next) {
    return { message: "Geçersiz adım." }
  }

  const mergedAnswers = { ...(instance.answers as Record<string, unknown>), ...values }
  const rulesMap = await getRuleConditionsMap()
  const nextNode = resolveActionableNode(currentNode.next, graph, mergedAnswers, {
    getRuleCondition: (id) => rulesMap.get(id),
  })
  const isEnd = nextNode.type === "end"
  const history = Array.isArray(instance.history) ? (instance.history as string[]) : []
  const updatedHistory = [...history, currentNode.id]

  // Kabul modalinde artık hasta kimlik bilgileri toplanmıyor — bu adımda
  // (genellikle "Kimlik Bilgileri" formu) gönderilen tcNo/firstName/lastName/
  // dateOfBirth/gender/phone alanları varsa, PatientV2 placeholder kaydına yazılır.
  const identityKeys = ["tcNo", "firstName", "lastName", "dateOfBirth", "gender", "phone"] as const
  const identityUpdate: Record<string, unknown> = {}
  for (const key of identityKeys) {
    if (key in values) identityUpdate[key] = values[key]
  }
  if (Object.keys(identityUpdate).length > 0) {
    if (typeof identityUpdate.tcNo === "string" && identityUpdate.tcNo) {
      const existing = await prisma.patientV2.findUnique({ where: { tcNo: identityUpdate.tcNo } })
      if (existing && existing.id !== instance.patientId) {
        return { errors: { tcNo: ["Bu TC kimlik numarasına sahip bir hasta zaten mevcut."] } }
      }
    }
    await prisma.patientV2.update({
      where: { id: instance.patientId },
      data: {
        ...(typeof identityUpdate.tcNo === "string" ? { tcNo: identityUpdate.tcNo || null } : {}),
        ...(typeof identityUpdate.firstName === "string" ? { firstName: identityUpdate.firstName } : {}),
        ...(typeof identityUpdate.lastName === "string" ? { lastName: identityUpdate.lastName } : {}),
        ...(typeof identityUpdate.dateOfBirth === "string" ? { dateOfBirth: new Date(identityUpdate.dateOfBirth) } : {}),
        ...(typeof identityUpdate.gender === "string" && identityUpdate.gender in GENDER_LABEL_TO_ENUM
          ? { gender: GENDER_LABEL_TO_ENUM[identityUpdate.gender] }
          : {}),
        ...(typeof identityUpdate.phone === "string" ? { phone: identityUpdate.phone } : {}),
      },
    })
  }

  await prisma.workflowInstance.update({
    where: { id: instanceId },
    data: {
      answers: JSON.parse(JSON.stringify(mergedAnswers)),
      currentNodeId: nextNode.id,
      status: isEnd ? "completed" : "in_progress",
      completedAt: isEnd ? new Date() : null,
      history: updatedHistory,
    },
  })

  if (isEnd) await promotePatientFromIntake(instanceId, instance.patientId, currentUser.userId)

  revalidatePath(`/clinicalos/intake/${instanceId}`)
  void logActivity({
    actorId: currentUser.userId,
    action: "intake.answer_submit",
    entityType: "workflow_instance",
    entityId: instanceId,
    entityLabel: instance.workflowDef.name,
    metadata: { nodeId: currentNode.id },
  }).catch(console.error)

  return { success: true }
}

export async function completeTaskAction(instanceId: string): Promise<ActionState> {
  const currentUser = await verifySession()
  requirePermission(currentUser, "intake:execute")

  const instance = await prisma.workflowInstance.findUnique({
    where: { id: instanceId },
    include: { workflowDef: true },
  })
  if (!instance) return { message: "Kabul kaydı bulunamadı." }

  const graph = (instance.workflowDef.nodes as unknown as WorkflowGraph).nodes
  const currentNode = graph.find((n) => n.id === instance.currentNodeId)
  if (!currentNode || currentNode.type !== "task" || !currentNode.next) {
    return { message: "Geçersiz adım." }
  }

  const existingTasks = Array.isArray(instance.tasks) ? (instance.tasks as unknown[]) : []
  const updatedTasks = [
    ...existingTasks,
    { nodeId: currentNode.id, completedAt: new Date().toISOString(), completedBy: currentUser.userId },
  ]

  const answers = instance.answers as Record<string, unknown>
  const rulesMap = await getRuleConditionsMap()
  const nextNode = resolveActionableNode(currentNode.next, graph, answers, {
    getRuleCondition: (id) => rulesMap.get(id),
  })
  const isEnd = nextNode.type === "end"
  const history = Array.isArray(instance.history) ? (instance.history as string[]) : []
  const updatedHistory = [...history, currentNode.id]

  await prisma.workflowInstance.update({
    where: { id: instanceId },
    data: {
      tasks: JSON.parse(JSON.stringify(updatedTasks)),
      currentNodeId: nextNode.id,
      status: isEnd ? "completed" : "in_progress",
      completedAt: isEnd ? new Date() : null,
      history: updatedHistory,
    },
  })

  if (isEnd) await promotePatientFromIntake(instanceId, instance.patientId, currentUser.userId)

  revalidatePath(`/clinicalos/intake/${instanceId}`)
  void logActivity({
    actorId: currentUser.userId,
    action: "intake.task_complete",
    entityType: "workflow_instance",
    entityId: instanceId,
    entityLabel: instance.workflowDef.name,
    metadata: { nodeId: currentNode.id },
  }).catch(console.error)

  return { success: true }
}

// Belge adımından bir sonrakine geçen tek yol — yükleme (documents POST route)
// artık asla otomatik ilerletmez, checklist'teki tüm zorunlu kalemler
// karşılanana kadar (bkz. isChecklistSatisfied) bu action adımı geçirmez.
export async function advanceDocumentStepAction(instanceId: string): Promise<ActionState> {
  const currentUser = await verifySession()
  requirePermission(currentUser, "intake:execute")

  const instance = await prisma.workflowInstance.findUnique({
    where: { id: instanceId },
    include: { workflowDef: true, documents: true },
  })
  if (!instance) return { message: "Kabul kaydı bulunamadı." }

  const graph = (instance.workflowDef.nodes as unknown as WorkflowGraph).nodes
  const currentNode = graph.find((n) => n.id === instance.currentNodeId)
  if (!currentNode || currentNode.type !== "document" || !currentNode.next) {
    return { message: "Geçersiz adım." }
  }

  const nodeDocuments = instance.documents.filter((d) => d.nodeId === currentNode.id)
  if (!isChecklistSatisfied(currentNode.checklist, nodeDocuments)) {
    return { message: "Devam etmeden önce tüm zorunlu belgeleri yüklemelisiniz." }
  }

  const rulesMap = await getRuleConditionsMap()
  const answers = instance.answers as Record<string, unknown>
  const nextNode = resolveActionableNode(currentNode.next, graph, answers, {
    getRuleCondition: (id) => rulesMap.get(id),
  })
  const isEnd = nextNode.type === "end"
  const history = Array.isArray(instance.history) ? (instance.history as string[]) : []
  const updatedHistory = [...history, currentNode.id]

  await prisma.workflowInstance.update({
    where: { id: instanceId },
    data: {
      currentNodeId: nextNode.id,
      status: isEnd ? "completed" : "in_progress",
      completedAt: isEnd ? new Date() : null,
      history: updatedHistory,
    },
  })

  if (isEnd) await promotePatientFromIntake(instanceId, instance.patientId, currentUser.userId)

  revalidatePath(`/clinicalos/intake/${instanceId}`)
  void logActivity({
    actorId: currentUser.userId,
    action: "intake.document_step_advance",
    entityType: "workflow_instance",
    entityId: instanceId,
    entityLabel: instance.workflowDef.name,
    metadata: { nodeId: currentNode.id },
  }).catch(console.error)

  return { success: true }
}

// Hatalı bir cevap/dallanma sonrası bir önceki actionable adıma dönmek için.
// `answers`/`tasks`/yüklenen belgeler silinmez (append-only geçmiş) — sadece
// currentNodeId geri alınır; kullanıcı o adımı düzeltip yeniden gönderdiğinde
// resolveActionableNode ileri yönlendirmeyi güncel cevaplarla yeniden hesaplar.
export async function goBackIntakeAction(instanceId: string): Promise<ActionState> {
  const currentUser = await verifySession()
  requirePermission(currentUser, "intake:execute")

  const instance = await prisma.workflowInstance.findUnique({
    where: { id: instanceId },
    include: { workflowDef: true },
  })
  if (!instance) return { message: "Kabul kaydı bulunamadı." }

  const graph = (instance.workflowDef.nodes as unknown as WorkflowGraph).nodes
  const currentNode = graph.find((n) => n.id === instance.currentNodeId)
  if (currentNode?.type === "end") {
    return { message: "Son kontrol tamamlandı, artık geri gidilip düzenleme yapılamaz." }
  }

  const history = Array.isArray(instance.history) ? (instance.history as string[]) : []
  if (history.length === 0) return { message: "Geri gidilecek adım yok." }

  const previousNodeId = history[history.length - 1]
  const updatedHistory = history.slice(0, -1)

  await prisma.workflowInstance.update({
    where: { id: instanceId },
    data: {
      currentNodeId: previousNodeId,
      status: "in_progress",
      completedAt: null,
      history: updatedHistory,
    },
  })

  revalidatePath(`/clinicalos/intake/${instanceId}`)
  void logActivity({
    actorId: currentUser.userId,
    action: "intake.go_back",
    entityType: "workflow_instance",
    entityId: instanceId,
    entityLabel: instance.workflowDef.name,
    metadata: { fromNodeId: instance.currentNodeId, toNodeId: previousNodeId },
  }).catch(console.error)

  return { success: true }
}

// Bitiş ekranındaki özet üzerinden geçmiş bir form adımını düzeltmek için.
// Sadece `answers`'ı günceller — currentNodeId/history/status'a dokunmaz,
// yani düzeltme workflow'u yeniden yönlendirmez (retroaktif re-routing
// kapsam dışı bırakıldı; bu sadece veri düzeltmesi).
export async function updateAnswersAction(
  instanceId: string,
  values: Record<string, unknown>,
): Promise<ActionState> {
  const currentUser = await verifySession()
  requirePermission(currentUser, "intake:execute")

  const instance = await prisma.workflowInstance.findUnique({
    where: { id: instanceId },
    include: { workflowDef: true },
  })
  if (!instance) return { message: "Kabul kaydı bulunamadı." }
  if (instance.status === "completed") {
    return { message: "Son kontrol tamamlandı, artık düzenleme yapılamaz." }
  }

  const mergedAnswers = { ...(instance.answers as Record<string, unknown>), ...values }

  await prisma.workflowInstance.update({
    where: { id: instanceId },
    data: { answers: JSON.parse(JSON.stringify(mergedAnswers)) },
  })

  revalidatePath(`/clinicalos/intake/${instanceId}`)
  void logActivity({
    actorId: currentUser.userId,
    action: "intake.answer_edit",
    entityType: "workflow_instance",
    entityId: instanceId,
    entityLabel: instance.workflowDef.name,
  }).catch(console.error)

  return { success: true, message: "Cevaplar güncellendi." }
}

export async function deleteIntakeInstanceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const currentUser = await verifySession()
  requirePermission(currentUser, "intake:execute")

  const instanceId = formData.get("id") as string
  if (!instanceId) return { message: "Kabul ID gerekli." }

  const instance = await prisma.workflowInstance.findUnique({
    where: { id: instanceId },
    include: { patient: true, workflowDef: { select: { name: true } } },
  })
  if (!instance) return { message: "Kabul kaydı bulunamadı." }

  // WorkflowDocument satırları FK cascade ile otomatik silinir; diskteki
  // dosyalar için ayrı temizlik gerekiyor.
  const instanceDir = path.join(UPLOAD_DIR, "clinicalos", instanceId)
  await fs.rm(instanceDir, { recursive: true, force: true }).catch(() => {})

  await prisma.workflowInstance.delete({ where: { id: instanceId } })

  revalidatePath("/clinicalos/intake")
  void logActivity({
    actorId: currentUser.userId,
    action: "intake.delete",
    entityType: "workflow_instance",
    entityId: instanceId,
    entityLabel: `${instance.patient.firstName} ${instance.patient.lastName}`,
    metadata: { workflowName: instance.workflowDef.name },
  }).catch(console.error)

  return { success: true, message: "Kabul kaydı silindi." }
}

export async function deleteWorkflowDocumentAction(documentId: string): Promise<ActionState> {
  const currentUser = await verifySession()
  requirePermission(currentUser, "intake:execute")

  const document = await prisma.workflowDocument.findUnique({
    where: { id: documentId },
    include: { workflowInstance: { include: { workflowDef: true } } },
  })
  if (!document) return { message: "Belge bulunamadı." }
  if (document.workflowInstance.status === "completed") {
    return { message: "Son kontrol tamamlandı, artık belge silinemez." }
  }

  const diskPath = path.join(UPLOAD_DIR, ...document.url.replace(/^\/api\/files\//, "").split("/"))
  await fs.unlink(diskPath).catch(() => {})
  await prisma.workflowDocument.delete({ where: { id: documentId } })

  revalidatePath(`/clinicalos/intake/${document.workflowInstanceId}`)
  void logActivity({
    actorId: currentUser.userId,
    action: "intake.document_delete",
    entityType: "workflow_instance",
    entityId: document.workflowInstanceId,
    entityLabel: document.workflowInstance.workflowDef.name,
    metadata: { fileName: document.name },
  }).catch(console.error)

  return { success: true, message: "Belge silindi." }
}
