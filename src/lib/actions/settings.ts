"use server"

import { revalidatePath } from "next/cache"
import { verifySession, requirePermission } from "@/lib/dal"
import { setNotificationSettings } from "@/lib/db/settings"
import { setUserNotifyStatuses } from "@/lib/db/users"
import { logActivity } from "@/lib/db/activity"
import type { PatientStatus } from "@/generated/prisma/enums"

export type SettingsFormState = {
  success?: boolean
  message?: string
}

export async function updateNotificationSettingsAction(
  _prev: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const session = await verifySession()
  requirePermission(session, "settings:manage")

  const bool = (key: string) => formData.get(key) === "true"

  await setNotificationSettings({
    appointmentDoctorEmail:       bool("appointmentDoctorEmail"),
    appointmentPatientEmail:      bool("appointmentPatientEmail"),
    appointmentStatusDoctorEmail: bool("appointmentStatusDoctorEmail"),
  })

  void logActivity({
    actorId: session.userId,
    action: "settings.update",
    entityType: "system",
    entityLabel: "Bildirim Ayarları",
  }).catch(console.error)

  revalidatePath("/settings")
  return { success: true, message: "Ayarlar kaydedildi." }
}

const PATIENT_STATUSES: PatientStatus[] = ["active", "inactive", "critical", "discharged"]

// Giriş yapan kullanıcının KENDİ bildirim tercihleri — yetki gerektirmez.
export async function updateMyNotificationPreferencesAction(
  _prev: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const session = await verifySession()

  const selected = PATIENT_STATUSES.filter((s) => formData.get(`status.${s}`) === "true")
  await setUserNotifyStatuses(session.userId, selected)

  void logActivity({
    actorId: session.userId,
    action: "settings.notifications.personal.update",
    entityType: "user",
    entityId: session.userId,
    entityLabel: session.name,
    metadata: { notifyPatientStatuses: selected },
  }).catch(console.error)

  revalidatePath("/settings")
  return { success: true, message: "Bildirim tercihleriniz kaydedildi." }
}
