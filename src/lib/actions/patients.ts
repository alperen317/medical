"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod/v4"
import { prisma } from "@/lib/prisma"
import type { Gender, BloodType, PatientStatus } from "@/generated/prisma/enums"
import { verifySession } from "@/lib/dal"
import { logActivity } from "@/lib/db/activity"
import { createNotification } from "@/lib/db/notifications"
import { getDoctors } from "@/lib/db/users"
import { sendDoctorAssignmentEmail, sendPatientStatusEmail } from "@/lib/mailer"
import { headers } from "next/headers"

const patientSchema = z.object({
  firstName: z.string().min(1, "Ad zorunludur"),
  lastName: z.string().min(1, "Soyad zorunludur"),
  dateOfBirth: z.string().min(1, "Doğum tarihi zorunludur"),
  gender: z.enum(["male", "female", "other"]),
  phone: z.string().min(10, "Geçerli bir telefon numarası girin"),
  tcNo: z.string().length(11, "TC kimlik 11 hane olmalıdır").optional().or(z.literal("")),
  email: z.email("Geçerli bir e-posta girin").optional().or(z.literal("")),
  address: z.string().optional(),
  bloodType: z
    .enum(["A_pos", "A_neg", "B_pos", "B_neg", "AB_pos", "AB_neg", "O_pos", "O_neg"])
    .optional(),
  status: z.enum(["active", "inactive", "critical", "discharged"]).default("active"),
  assignedDoctorId: z.string().optional().or(z.literal("")),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactRelation: z.string().optional(),
  allergies: z.string().optional(),
  chronicConditions: z.string().optional(),
})

export type PatientFormState = {
  errors?: Record<string, string[]>
  message?: string
  success?: boolean
  patientId?: string
}

async function getPatientLink() {
  const h = await headers()
  const host = h.get("host") ?? "localhost:8060"
  const protocol = host.startsWith("localhost") ? "http" : "https"
  return (patientId: string) => `${protocol}://${host}/patients/${patientId}`
}

async function notifyDoctor(
  doctorId: string,
  patient: {
    id: string
    firstName: string
    lastName: string
    dateOfBirth: Date
    status: string
    emergencyContactName?: string | null
    emergencyContactPhone?: string | null
    emergencyContactRelation?: string | null
  }
) {
  const doctor = await prisma.user.findUnique({
    where: { id: doctorId },
    select: { email: true, name: true },
  })
  if (!doctor) return
  const buildLink = await getPatientLink()
  sendDoctorAssignmentEmail({
    to: doctor.email,
    doctorName: doctor.name,
    patient,
    patientLink: buildLink(patient.id),
  }).catch((err) => console.error("[mailer] assignment email failed:", err))
}

export async function createPatientAction(
  _prev: PatientFormState,
  formData: FormData
): Promise<PatientFormState> {
  const session = await verifySession()
  const raw = Object.fromEntries(formData)
  const validated = patientSchema.safeParse(raw)

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors }
  }

  const {
    firstName, lastName, dateOfBirth, gender, phone,
    tcNo, email, address, bloodType, status,
    assignedDoctorId, emergencyContactName, emergencyContactPhone, emergencyContactRelation,
    allergies: allergiesRaw, chronicConditions: chronicConditionsRaw,
  } = validated.data

  let allergies: string[] = []
  let chronicConditions: string[] = []
  try {
    if (allergiesRaw) allergies = JSON.parse(allergiesRaw)
    if (chronicConditionsRaw) chronicConditions = JSON.parse(chronicConditionsRaw)
  } catch {
    // geçersiz JSON — boş dizi kullan
  }

  try {
    const patient = await prisma.patient.create({
      data: {
        firstName,
        lastName,
        dateOfBirth: new Date(dateOfBirth),
        gender: gender as Gender,
        phone,
        tcNo: tcNo || null,
        email: email || null,
        address: address || null,
        bloodType: (bloodType as BloodType) ?? null,
        status: status as PatientStatus,
        assignedDoctorId: assignedDoctorId || null,
        emergencyContactName: emergencyContactName || null,
        emergencyContactPhone: emergencyContactPhone || null,
        emergencyContactRelation: emergencyContactRelation || null,
        allergies,
        chronicConditions,
      },
    })
    revalidatePath("/patients")
    void logActivity({
      actorId: session.userId,
      action: "patient.create",
      entityType: "patient",
      entityId: patient.id,
      entityLabel: `${firstName} ${lastName}`,
    }).catch(console.error)
    if (assignedDoctorId) {
      void notifyDoctor(assignedDoctorId, {
        id: patient.id,
        firstName,
        lastName,
        dateOfBirth: new Date(dateOfBirth),
        status,
        emergencyContactName: emergencyContactName || null,
        emergencyContactPhone: emergencyContactPhone || null,
        emergencyContactRelation: emergencyContactRelation || null,
      })
    }
    return { success: true, patientId: patient.id, message: "Hasta başarıyla oluşturuldu" }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Bilinmeyen hata"
    if (msg.includes("tcNo")) return { errors: { tcNo: ["Bu TC kimlik numarası zaten kayıtlı"] } }
    return { message: "Hasta oluşturulamadı. Lütfen tekrar deneyin." }
  }
}

const updatePatientSchema = patientSchema.extend({
  patientId: z.string().min(1),
})

export async function updatePatientAction(
  _prev: PatientFormState,
  formData: FormData
): Promise<PatientFormState> {
  const session = await verifySession()
  const raw = Object.fromEntries(formData)
  const validated = updatePatientSchema.safeParse(raw)

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors }
  }

  const {
    patientId,
    firstName, lastName, dateOfBirth, gender, phone,
    tcNo, email, address, bloodType, status,
    assignedDoctorId, emergencyContactName, emergencyContactPhone, emergencyContactRelation,
    allergies: allergiesRaw, chronicConditions: chronicConditionsRaw,
  } = validated.data

  let allergies: string[] = []
  let chronicConditions: string[] = []
  try {
    if (allergiesRaw) allergies = JSON.parse(allergiesRaw)
    if (chronicConditionsRaw) chronicConditions = JSON.parse(chronicConditionsRaw)
  } catch {
    // geçersiz JSON — boş dizi kullan
  }

  try {
    const prev = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { assignedDoctorId: true },
    })

    await prisma.patient.update({
      where: { id: patientId },
      data: {
        firstName,
        lastName,
        dateOfBirth: new Date(dateOfBirth),
        gender: gender as Gender,
        phone,
        tcNo: tcNo || null,
        email: email || null,
        address: address || null,
        bloodType: (bloodType as BloodType) ?? null,
        status: status as PatientStatus,
        assignedDoctorId: assignedDoctorId || null,
        emergencyContactName: emergencyContactName || null,
        emergencyContactPhone: emergencyContactPhone || null,
        emergencyContactRelation: emergencyContactRelation || null,
        allergies,
        chronicConditions,
      },
    })
    revalidatePath(`/patients/${patientId}`)
    revalidatePath("/patients")
    void logActivity({
      actorId: session.userId,
      action: "patient.update",
      entityType: "patient",
      entityId: patientId,
      entityLabel: `${firstName} ${lastName}`,
    }).catch(console.error)
    const newDoctorId = assignedDoctorId || null
    if (newDoctorId && newDoctorId !== prev?.assignedDoctorId) {
      void notifyDoctor(newDoctorId, {
        id: patientId,
        firstName,
        lastName,
        dateOfBirth: new Date(dateOfBirth),
        status,
        emergencyContactName: emergencyContactName || null,
        emergencyContactPhone: emergencyContactPhone || null,
        emergencyContactRelation: emergencyContactRelation || null,
      })
    }
    return { success: true, patientId, message: "Hasta bilgileri güncellendi" }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Bilinmeyen hata"
    if (msg.includes("tcNo")) return { errors: { tcNo: ["Bu TC kimlik numarası zaten kayıtlı"] } }
    return { message: "Bilgiler güncellenemedi. Lütfen tekrar deneyin." }
  }
}

export async function getRecommendedDoctorAction(
  departmentId: string
): Promise<{ doctorId: string | null; name: string | null }> {
  const doctors = await getDoctors()
  const inDept = doctors.filter((d) =>
    d.departments.some((dep) => dep.id === departmentId)
  )
  if (inDept.length === 0) return { doctorId: null, name: null }
  const least = inDept.reduce((min, d) =>
    d._count.patients < min._count.patients ? d : min
  )
  return { doctorId: least.id, name: least.name }
}

export async function updatePatientStatusAction(
  patientId: string,
  status: PatientStatus
): Promise<{ success: boolean; message: string }> {
  try {
    const [session, patient] = await Promise.all([
      verifySession(),
      prisma.patient.findUnique({
        where: { id: patientId },
        select: { firstName: true, lastName: true, status: true, assignedDoctorId: true },
      }),
    ])
    if (!patient) return { success: false, message: "Hasta bulunamadı" }

    const prevStatus = patient.status
    if (prevStatus === status) {
      return { success: true, message: "Durum zaten güncel" }
    }

    await prisma.patient.update({ where: { id: patientId }, data: { status } })
    revalidatePath(`/patients/${patientId}`)
    revalidatePath("/patients")
    void logActivity({
      actorId: session.userId,
      action: "patient.status_change",
      entityType: "patient",
      entityId: patientId,
      entityLabel: `${patient.firstName} ${patient.lastName}`,
      metadata: { from: prevStatus, to: status },
    }).catch(console.error)

    const doctorId = patient.assignedDoctorId
    if (doctorId && doctorId !== session.userId) {
      const patientName = `${patient.firstName} ${patient.lastName}`

      // Kritik durumda her zaman in-app uyarı (mevcut davranış korunuyor).
      if (status === "critical") {
        void createNotification({
          userId: doctorId,
          type: "critical_patient",
          title: "Kritik Hasta Uyarısı",
          body: `${patientName} hastasının durumu KRİTİK olarak güncellendi.`,
          entityType: "patient",
          entityId: patientId,
        }).catch(console.error)
      }

      // Doktor bu duruma e-posta almayı seçmişse bildir.
      const doctor = await prisma.user.findUnique({
        where: { id: doctorId },
        select: { email: true, name: true, notifyPatientStatuses: true },
      })
      if (doctor?.notifyPatientStatuses.includes(status)) {
        const buildLink = await getPatientLink()
        void sendPatientStatusEmail({
          to: doctor.email,
          doctorName: doctor.name,
          patientName,
          oldStatus: prevStatus,
          newStatus: status,
          patientLink: buildLink(patientId),
        }).catch((err) => console.error("[mailer] status email failed:", err))
      }
    }

    return { success: true, message: "Durum güncellendi" }
  } catch {
    return { success: false, message: "Durum güncellenemedi" }
  }
}
