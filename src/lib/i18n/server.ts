import "server-only"
import { cache } from "react"
import { cookies } from "next/headers"
import { isValidLang, DEFAULT_LANG, LANG_COOKIE } from "./languages"
import { getTranslations } from "@/lib/db/translations"
import { DEFAULT_TRANSLATIONS, type TranslationKey } from "./defaults"

const _getTranslationsForRequest = cache(async () => {
  const cookieStore = await cookies()
  const rawLang = cookieStore.get(LANG_COOKIE)?.value
  const lang = isValidLang(rawLang) ? rawLang : DEFAULT_LANG
  return getTranslations(lang)
})

export async function getServerT() {
  const translations = await _getTranslationsForRequest()
  return function t(key: TranslationKey, fallback?: string): string {
    return translations[key] ?? DEFAULT_TRANSLATIONS[key] ?? fallback ?? key
  }
}
