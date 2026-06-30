"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { isValidLang, LANG_COOKIE, type LangCode } from "@/lib/i18n/languages"

export async function setLanguageAction(lang: LangCode): Promise<void> {
  if (!isValidLang(lang)) return

  const store = await cookies()
  store.set(LANG_COOKIE, lang, {
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
    httpOnly: false,
  })

  revalidatePath("/", "layout")
}
