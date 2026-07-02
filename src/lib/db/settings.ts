import "server-only"
import { prisma } from "@/lib/prisma"

export type NotificationSettings = {
  appointmentDoctorEmail: boolean
  appointmentPatientEmail: boolean
  appointmentStatusDoctorEmail: boolean
  appointmentReminderPatientEmail: boolean
}

const DEFAULTS: NotificationSettings = {
  appointmentDoctorEmail: true,
  appointmentPatientEmail: false,
  appointmentStatusDoctorEmail: false,
  appointmentReminderPatientEmail: false,
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const rows = await prisma.systemSetting.findMany({
    where: { key: { startsWith: "notify." } },
  })
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  return {
    appointmentDoctorEmail:       (map["notify.appointment.doctor.email"]        ?? "true")  === "true",
    appointmentPatientEmail:      (map["notify.appointment.patient.email"]       ?? "false") === "true",
    appointmentStatusDoctorEmail: (map["notify.appointment.status.doctor.email"] ?? "false") === "true",
    appointmentReminderPatientEmail: (map["notify.appointment.reminder.patient.email"] ?? "false") === "true",
  }
}

export async function setNotificationSettings(settings: Partial<NotificationSettings>): Promise<void> {
  const pairs: [string, boolean][] = [
    ["notify.appointment.doctor.email",        settings.appointmentDoctorEmail        ?? DEFAULTS.appointmentDoctorEmail],
    ["notify.appointment.patient.email",       settings.appointmentPatientEmail       ?? DEFAULTS.appointmentPatientEmail],
    ["notify.appointment.status.doctor.email", settings.appointmentStatusDoctorEmail  ?? DEFAULTS.appointmentStatusDoctorEmail],
    ["notify.appointment.reminder.patient.email", settings.appointmentReminderPatientEmail ?? DEFAULTS.appointmentReminderPatientEmail],
  ]

  await Promise.all(
    pairs.map(([key, val]) =>
      prisma.systemSetting.upsert({
        where: { key },
        update: { value: String(val) },
        create: { key, value: String(val) },
      })
    )
  )
}
