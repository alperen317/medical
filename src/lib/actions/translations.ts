"use server"

import { revalidatePath } from "next/cache"
import { verifySession, requirePermission } from "@/lib/dal"
import { setTranslation, resetTranslation } from "@/lib/db/translations"
import { DEFAULT_TRANSLATIONS, type TranslationKey } from "@/lib/i18n/defaults"
import { isValidLang, type LangCode } from "@/lib/i18n/languages"
import { logActivity } from "@/lib/db/activity"

export type TranslationActionState = {
  success?: boolean
  message?: string
}

export async function updateTranslationAction(
  _prev: TranslationActionState,
  formData: FormData
): Promise<TranslationActionState> {
  const session = await verifySession()
  requirePermission(session, "settings:manage")

  const key = formData.get("key") as string
  const value = formData.get("value") as string
  const langRaw = formData.get("lang") as string
  const lang: LangCode = isValidLang(langRaw) ? langRaw : "tr"

  if (!key || !(key in DEFAULT_TRANSLATIONS)) {
    return { success: false, message: "Geçersiz çeviri anahtarı." }
  }
  if (value === undefined || value === null) {
    return { success: false, message: "Değer boş olamaz." }
  }

  await setTranslation(lang, key, value.trim() || DEFAULT_TRANSLATIONS[key as TranslationKey])

  void logActivity({
    actorId: session.userId,
    action: "settings.translation.update",
    entityType: "system",
    entityLabel: `Çeviri [${lang.toUpperCase()}]: ${key}`,
    metadata: { lang, key, value },
  }).catch(console.error)

  revalidatePath("/settings/translations")
  return { success: true, message: "Metin güncellendi." }
}

export async function resetTranslationAction(
  _prev: TranslationActionState,
  formData: FormData
): Promise<TranslationActionState> {
  const session = await verifySession()
  requirePermission(session, "settings:manage")

  const key = formData.get("key") as string
  const langRaw = formData.get("lang") as string
  const lang: LangCode = isValidLang(langRaw) ? langRaw : "tr"

  if (!key || !(key in DEFAULT_TRANSLATIONS)) {
    return { success: false, message: "Geçersiz çeviri anahtarı." }
  }

  await resetTranslation(lang, key)

  void logActivity({
    actorId: session.userId,
    action: "settings.translation.reset",
    entityType: "system",
    entityLabel: `Çeviri Sıfırla [${lang.toUpperCase()}]: ${key}`,
    metadata: { lang, key },
  }).catch(console.error)

  revalidatePath("/settings/translations")
  return { success: true, message: "Varsayılan değere döndürüldü." }
}
