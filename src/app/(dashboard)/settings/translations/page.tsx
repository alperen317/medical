import { redirect } from "next/navigation"
import { Languages } from "lucide-react"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { verifySession } from "@/lib/dal"
import { getTranslationOverrides } from "@/lib/db/translations"
import { getDefaultsForLang, LANGUAGES, isValidLang, type LangCode } from "@/lib/i18n/languages"
import { TranslationsClient } from "./_components/translations-client"

type Props = {
  searchParams: Promise<{ lang?: string }>
}

export default async function TranslationsPage({ searchParams }: Props) {
  const session = await verifySession()

  if (!session.permissions.includes("settings:manage")) {
    redirect("/settings")
  }

  const { lang: langParam } = await searchParams
  const lang: LangCode = isValidLang(langParam) ? langParam : "tr"

  const defaults = getDefaultsForLang(lang)
  const overrides = await getTranslationOverrides(lang)

  const entries = Object.entries(defaults).map(([key, defaultValue]) => ({
    key,
    defaultValue,
    currentValue: overrides[key] ?? defaultValue,
    isCustomized: key in overrides,
  }))

  const langConfig = LANGUAGES[lang]

  return (
    <div>
      <Header
        title={langConfig.flag + " Arayüz Metinleri"}
        subtitle="Uygulamada görüntülenen metin ve etiketleri dile göre özelleştirin"
      />
      <div className="p-6 space-y-4">
        {/* Language Tabs */}
        <div className="flex gap-2">
          {(Object.entries(LANGUAGES) as [LangCode, typeof LANGUAGES[LangCode]][]).map(([code, cfg]) => (
            <a
              key={code}
              href={`/settings/translations?lang=${code}`}
              className={[
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                code === lang
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
              ].join(" ")}
            >
              <span>{cfg.flag}</span>
              <span>{cfg.label}</span>
            </a>
          ))}
        </div>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Languages className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">
                {langConfig.flag} {langConfig.label} — Metin Özelleştirme
              </CardTitle>
            </div>
            <CardDescription>
              Aşağıdaki listedeki herhangi bir metni düzenleyebilirsiniz. Değişiklikler tüm{" "}
              <strong>{langConfig.label}</strong> kullanan kullanıcılar için anında geçerli olur.
              Özelleştirilmiş metinleri varsayılan değerine döndürmek için sıfırlayabilirsiniz.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <TranslationsClient entries={entries} lang={lang} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
