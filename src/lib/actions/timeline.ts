"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod/v4"
import { createTimelineEvent, deleteTimelineEvent } from "@/lib/db/timeline"
import { can } from "@/lib/permissions"
import { verifySession } from "@/lib/dal"
import { logActivity } from "@/lib/db/activity"
import { prisma } from "@/lib/prisma"

const eventSchema = z.object({
  type: z.enum(["visit", "diagnosis", "treatment", "note", "document", "prescription", "lab"]),
  title: z.string().min(1, "Başlık zorunludur"),
  description: z.string().min(1, "Açıklama zorunludur"),
  date: z.string().min(1, "Tarih zorunludur"),
  metadata: z.string().optional(),
})

export type TimelineEventFormState = {
  errors?: Record<string, string[]>
  message?: string
  success?: boolean
}

export async function createTimelineEventAction(
  patientId: string,
  _prev: TimelineEventFormState,
  formData: FormData
): Promise<TimelineEventFormState> {
  const session = await verifySession()

  const raw = Object.fromEntries(formData)
  const validated = eventSchema.safeParse(raw)

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors }
  }

  let metadata: Record<string, string> | undefined
  try {
    if (validated.data.metadata) metadata = JSON.parse(validated.data.metadata)
  } catch {
    // geçersiz JSON — metadata gönderilmez
  }

  try {
    const [event, patient] = await Promise.all([
      createTimelineEvent({
        type: validated.data.type,
        title: validated.data.title,
        description: validated.data.description,
        date: new Date(validated.data.date),
        patientId,
        createdById: session.userId,
        metadata,
      }),
      prisma.patient.findUnique({
        where: { id: patientId },
        select: { firstName: true, lastName: true },
      }),
    ])
    revalidatePath(`/patients/${patientId}`)
    void logActivity({
      actorId: session.userId,
      action: "timeline.create",
      entityType: "timeline",
      entityId: event.id,
      entityLabel: patient ? `${patient.firstName} ${patient.lastName}` : undefined,
      metadata: { type: validated.data.type, title: validated.data.title },
    }).catch(console.error)
    return { success: true, message: "Kayıt eklendi" }
  } catch {
    return { message: "Kayıt oluşturulamadı. Lütfen tekrar deneyin." }
  }
}

export async function deleteTimelineEventAction(
  eventId: string,
  patientId: string
): Promise<{ success?: boolean; message?: string }> {
  const session = await verifySession()

  if (!can(session.permissions, "timeline:delete")) {
    return { message: "Bu işlem için yetkiniz yok." }
  }

  try {
    const [, patient] = await Promise.all([
      deleteTimelineEvent(eventId),
      prisma.patient.findUnique({
        where: { id: patientId },
        select: { firstName: true, lastName: true },
      }),
    ])
    revalidatePath(`/patients/${patientId}`)
    void logActivity({
      actorId: session.userId,
      action: "timeline.delete",
      entityType: "timeline",
      entityId: eventId,
      entityLabel: patient ? `${patient.firstName} ${patient.lastName}` : undefined,
    }).catch(console.error)
    return { success: true }
  } catch {
    return { message: "Kayıt silinemedi. Lütfen tekrar deneyin." }
  }
}
