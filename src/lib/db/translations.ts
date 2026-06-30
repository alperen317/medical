import "server-only"
import { prisma } from "@/lib/prisma"
import { getDefaultsForLang, type LangCode } from "@/lib/i18n/languages"

function prefix(lang: LangCode) {
  return `i18n.${lang}.`
}

export async function getTranslations(lang: LangCode): Promise<Record<string, string>> {
  const pre = prefix(lang)
  const rows = await prisma.systemSetting.findMany({
    where: { key: { startsWith: pre } },
  })
  const overrides = Object.fromEntries(
    rows.map((r) => [r.key.slice(pre.length), r.value])
  )
  return { ...getDefaultsForLang(lang), ...overrides }
}

export async function getTranslationOverrides(lang: LangCode): Promise<Record<string, string>> {
  const pre = prefix(lang)
  const rows = await prisma.systemSetting.findMany({
    where: { key: { startsWith: pre } },
  })
  return Object.fromEntries(rows.map((r) => [r.key.slice(pre.length), r.value]))
}

export async function setTranslation(lang: LangCode, key: string, value: string): Promise<void> {
  const dbKey = prefix(lang) + key
  await prisma.systemSetting.upsert({
    where: { key: dbKey },
    update: { value },
    create: { key: dbKey, value },
  })
}

export async function resetTranslation(lang: LangCode, key: string): Promise<void> {
  await prisma.systemSetting.deleteMany({ where: { key: prefix(lang) + key } })
}
