"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod/v4"
import { prisma } from "@/lib/prisma"
import { verifySession } from "@/lib/dal"
import { logActivity } from "@/lib/db/activity"
import { createNotification } from "@/lib/db/notifications"
import { sendPatientActionEmail } from "@/lib/mailer"

const prescriptionSchema = z.object({
  patientId: z.string().min(1),
  medication: z.string().min(1, "İlaç adı zorunludur"),
  dosage: z.string().min(1, "Dozaj zorunludur"),
  frequency: z.string().min(1, "Kullanım sıklığı zorunludur"),
  duration: z.string().min(1, "Süre zorunludur"),
  instructions: z.string().optional(),
  prescribedAt: z.string().min(1, "Tarih zorunludur"),
})

export type PrescriptionFormState = {
  errors?: Record<string, string[]>
  message?: string
  success?: boolean
}

export async function createPrescriptionAction(
  _prev: PrescriptionFormState,
  formData: FormData
): Promise<PrescriptionFormState> {
  const session = await verifySession()
  const raw = Object.fromEntries(formData)
  const validated = prescriptionSchema.safeParse(raw)

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors }
  }

  const { patientId, medication, dosage, frequency, duration, instructions, prescribedAt } =
    validated.data

  try {
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: {
        firstName: true,
        lastName: true,
        assignedDoctor: {
          select: { id: true, email: true, name: true, notifyOnActions: true },
        },
      },
    })

    await prisma.prescription.create({
      data: {
        patientId,
        medication,
        dosage,
        frequency,
        duration,
        instructions: instructions || null,
        prescribedAt: new Date(prescribedAt),
        prescribedById: session.userId,
        active: true,
      },
    })

    revalidatePath(`/patients/${patientId}`)

    void logActivity({
      actorId: session.userId,
      action: "prescription.create",
      entityType: "prescription",
      entityId: patientId,
      entityLabel: patient ? `${patient.firstName} ${patient.lastName} — ${medication}` : medication,
      metadata: { medication, dosage, frequency, duration },
    }).catch(console.error)

    // Hasta atanmış doktorun bildirim tercihini kontrol et
    if (patient?.assignedDoctor && patient.assignedDoctor.id !== session.userId) {
      const doctor = patient.assignedDoctor
      if (doctor.notifyOnActions.includes("prescription_added")) {
        const patientName = `${patient.firstName} ${patient.lastName}`
        const actionLabel = "Reçete Eklendi"
        const actionDescription = `${medication} ${dosage} — ${frequency}`

        void createNotification({
          userId: doctor.id,
          type: "prescription_added",
          title: actionLabel,
          body: `${patientName} — ${medication}`,
          entityType: "patient",
          entityId: patientId,
        }).catch(console.error)

        const headersModule = await import("next/headers")
        const host = (await headersModule.headers()).get("host") ?? "localhost:8060"
        const protocol = host.startsWith("localhost") ? "http" : "https"
        const patientLink = `${protocol}://${host}/patients/${patientId}`

        void sendPatientActionEmail({
          to: doctor.email,
          doctorName: doctor.name,
          patientName,
          actionLabel,
          actionDescription,
          patientLink,
        }).catch((err) => console.error("[mailer] prescription notification email failed:", err))
      }
    }

    return { success: true }
  } catch {
    return { message: "Reçete oluşturulamadı. Lütfen tekrar deneyin." }
  }
}
