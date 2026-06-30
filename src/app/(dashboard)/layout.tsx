import { cookies } from "next/headers"
import { Sidebar } from "@/components/layout/sidebar"
import { Toaster } from "@/components/ui/toaster"
import { SessionProvider } from "@/store/session-provider"
import { TranslationsProvider } from "@/store/translations-context"
import { verifySession } from "@/lib/dal"
import { getTranslations } from "@/lib/db/translations"
import { isValidLang, DEFAULT_LANG, LANG_COOKIE } from "@/lib/i18n/languages"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const rawLang = cookieStore.get(LANG_COOKIE)?.value
  const lang = isValidLang(rawLang) ? rawLang : DEFAULT_LANG

  const [user, translations] = await Promise.all([
    verifySession(),
    getTranslations(lang),
  ])

  return (
    <SessionProvider user={user}>
      <TranslationsProvider translations={translations} lang={lang}>
        <div className="flex h-screen overflow-hidden bg-background">
          <Sidebar />
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
        <Toaster />
      </TranslationsProvider>
    </SessionProvider>
  )
}
