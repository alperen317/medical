"use client"

import { createContext, useContext } from "react"
import { DEFAULT_TRANSLATIONS, type TranslationKey } from "@/lib/i18n/defaults"
import { DEFAULT_LANG, type LangCode } from "@/lib/i18n/languages"

type TranslationsCtx = {
  translations: Record<string, string>
  lang: LangCode
}

const TranslationsContext = createContext<TranslationsCtx>({
  translations: DEFAULT_TRANSLATIONS,
  lang: DEFAULT_LANG,
})

export function TranslationsProvider({
  translations,
  lang,
  children,
}: {
  translations: Record<string, string>
  lang: LangCode
  children: React.ReactNode
}) {
  return (
    <TranslationsContext.Provider value={{ translations, lang }}>
      {children}
    </TranslationsContext.Provider>
  )
}

export function useLang(): LangCode {
  return useContext(TranslationsContext).lang
}

export function useTranslations() {
  return useContext(TranslationsContext).translations
}

export function useT() {
  const { translations } = useContext(TranslationsContext)
  return function t(key: TranslationKey, fallback?: string): string {
    return translations[key] ?? DEFAULT_TRANSLATIONS[key] ?? fallback ?? key
  }
}
