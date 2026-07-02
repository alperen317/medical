"use server"

import { revalidatePath } from "next/cache"
import { verifySession, requirePermission } from "@/lib/dal"
import { setNotificationSettings } from "@/lib/db/settings"
import { setUserNotifyStatuses, setUserNotifyActions } from "@/lib/db/users"
import { logActivity } from "@/lib/db/activity"
import type { PatientStatus, NotificationAction } from "@/generated/prisma/enums"

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
    appointmentReminderPatientEmail: bool("appointmentReminderPatientEmail"),
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
const NOTIFICATION_ACTIONS: NotificationAction[] = ["report_added", "prescription_added"]

// Giriş yapan kullanıcının KENDİ bildirim tercihleri — yetki gerektirmez.
export async function updateMyNotificationPreferencesAction(
  _prev: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const session = await verifySession()

  const selectedStatuses = PATIENT_STATUSES.filter((s) => formData.get(`status.${s}`) === "true")
  await setUserNotifyStatuses(session.userId, selectedStatuses)

  const selectedActions = NOTIFICATION_ACTIONS.filter((a) => formData.get(`action.${a}`) === "true")
  await setUserNotifyActions(session.userId, selectedActions)

  void logActivity({
    actorId: session.userId,
    action: "settings.notifications.personal.update",
    entityType: "user",
    entityId: session.userId,
    entityLabel: session.name,
    metadata: { notifyPatientStatuses: selectedStatuses, notifyOnActions: selectedActions },
  }).catch(console.error)

  revalidatePath("/settings")
  return { success: true, message: "Bildirim tercihleriniz kaydedildi." }
}
