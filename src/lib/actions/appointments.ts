"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod/v4"
import { verifySession } from "@/lib/dal"
import { logActivity } from "@/lib/db/activity"
import { createAppointmentDb, updateAppointmentStatusDb, findConflictingAppointment } from "@/lib/db/appointments"
import { createNotification } from "@/lib/db/notifications"
import { getNotificationSettings } from "@/lib/db/settings"
import { sendAppointmentEmail } from "@/lib/mailer"
import { prisma } from "@/lib/prisma"

const appointmentSchema = z.object({
  patientId: z.string().min(1, "Hasta zorunludur"),
  doctorId: z.string().min(1, "Doktor zorunludur"),
  scheduledAt: z.string().min(1, "Tarih ve saat zorunludur"),
  duration: z.coerce.number().int().min(5).default(30),
  type: z.enum(["consultation", "follow_up", "procedure", "lab", "other"]),
  notes: z.string().optional(),
})

export type AppointmentFormState = {
  errors?: Record<string, string[]>
  message?: string
  success?: boolean
}

export async function createAppointmentAction(
  _prev: AppointmentFormState,
  formData: FormData
): Promise<AppointmentFormState> {
  const session = await verifySession()
  const raw = Object.fromEntries(formData)
  const validated = appointmentSchema.safeParse(raw)

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors }
  }

  const { patientId, doctorId, scheduledAt, duration, type, notes } = validated.data

  try {
    const conflict = await findConflictingAppointment({
      doctorId,
      scheduledAt: new Date(scheduledAt),
      duration,
    })
    if (conflict) {
      const conflictTime = new Intl.DateTimeFormat("tr-TR", {
        hour: "2-digit", minute: "2-digit",
      }).format(new Date(conflict.scheduledAt))
      return {
        errors: {
          scheduledAt: [
            `Bu saat aralığı dolu: ${conflict.patient.firstName} ${conflict.patient.lastName} (${conflictTime}, ${conflict.duration} dk).`,
          ],
        },
      }
    }

    const [patient, doctor, notifySettings] = await Promise.all([
      prisma.patient.findUnique({ where: { id: patientId }, select: { firstName: true, lastName: true, email: true } }),
      prisma.user.findUnique({ where: { id: doctorId }, select: { name: true, email: true } }),
      getNotificationSettings(),
    ])

    const appointment = await createAppointmentDb({
      patientId,
      doctorId,
      scheduledAt: new Date(scheduledAt),
      duration,
      type: type as Parameters<typeof createAppointmentDb>[0]["type"],
      notes: notes || undefined,
      createdById: session.userId,
    })

    revalidatePath("/appointments")

    const patientName = patient ? `${patient.firstName} ${patient.lastName}` : "Hasta"
    const scheduledDate = new Date(scheduledAt)

    if (doctorId !== session.userId) {
      const dateStr = new Intl.DateTimeFormat("tr-TR", {
        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
      }).format(scheduledDate)
      void createNotification({
        userId: doctorId,
        type: "new_appointment",
        title: "Yeni Randevu",
        body: `${patientName} için ${dateStr} tarihinde randevu oluşturuldu.`,
        entityType: "appointment",
        entityId: appointment.id,
      }).catch(console.error)

      if (notifySettings.appointmentDoctorEmail && doctor?.email) {
        void sendAppointmentEmail({
          to: doctor.email,
          recipientName: doctor.name,
          patientName,
          doctorName: doctor.name,
          scheduledAt: scheduledDate,
          duration,
          type,
          notes,
        }).catch((err) => console.error("[mailer] appointment doctor email failed:", err))
      }
    }

    if (notifySettings.appointmentPatientEmail && patient?.email) {
      void sendAppointmentEmail({
        to: patient.email,
        recipientName: patientName,
        patientName,
        doctorName: doctor?.name ?? "Doktor",
        scheduledAt: scheduledDate,
        duration,
        type,
        notes,
      }).catch((err) => console.error("[mailer] appointment patient email failed:", err))
    }

    void logActivity({
      actorId: session.userId,
      action: "appointment.create",
      entityType: "appointment",
      entityId: appointment.id,
      entityLabel: patient ? `${patient.firstName} ${patient.lastName} — ${doctor?.name ?? ""}` : undefined,
      metadata: { type, scheduledAt, duration },
    }).catch(console.error)

    return { success: true }
  } catch {
    return { message: "Randevu oluşturulamadı. Lütfen tekrar deneyin." }
  }
}

export async function updateAppointmentStatusAction(
  id: string,
  status: "completed" | "cancelled" | "no_show"
): Promise<{ success: boolean; message: string }> {
  try {
    const session = await verifySession()

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        patient: { select: { firstName: true, lastName: true } },
        doctor: { select: { name: true } },
      },
    })

    await updateAppointmentStatusDb(id, status)
    revalidatePath("/appointments")

    void logActivity({
      actorId: session.userId,
      action: "appointment.status_change",
      entityType: "appointment",
      entityId: id,
      entityLabel: appointment?.patient
        ? `${appointment.patient.firstName} ${appointment.patient.lastName} — ${appointment.doctor?.name ?? ""}`
        : undefined,
      metadata: { status },
    }).catch(console.error)

    return { success: true, message: "Randevu güncellendi" }
  } catch {
    return { success: false, message: "Randevu güncellenemedi" }
  }
}
