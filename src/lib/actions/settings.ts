"use server"

import { revalidatePath } from "next/cache"
import { verifySession, requirePermission } from "@/lib/dal"
import { setNotificationSettings } from "@/lib/db/settings"
import { logActivity } from "@/lib/db/activity"

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
