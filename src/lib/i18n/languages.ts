import { DEFAULT_TRANSLATIONS } from "./defaults"
import { EN_TRANSLATIONS } from "./en"

export const LANGUAGES = {
  tr: {
    label: "Türkçe",
    nativeLabel: "TR",
    flag: "🇹🇷",
    translations: DEFAULT_TRANSLATIONS,
  },
  en: {
    label: "English",
    nativeLabel: "EN",
    flag: "🇬🇧",
    translations: EN_TRANSLATIONS,
  },
} as const

export type LangCode = keyof typeof LANGUAGES
export const DEFAULT_LANG: LangCode = "tr"
export const LANG_COOKIE = "medpanel_lang"

export function isValidLang(lang: unknown): lang is LangCode {
  return typeof lang === "string" && lang in LANGUAGES
}

export function getDefaultsForLang(lang: LangCode): Record<string, string> {
  return LANGUAGES[lang].translations as Record<string, string>
}
