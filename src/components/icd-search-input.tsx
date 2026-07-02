"use client"

import { useEffect, useRef, useState } from "react"
import { Search, Loader2, Plus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useT } from "@/store/translations-context"

type IcdEntry = { code: string; title: string }

/**
 * WHO ICD-11 arama kutusu. Kullanıcı yazar, /api/icd/search proxy'sinden
 * kodlu sonuçlar gelir; seçilen giriş `onSelect(entry)` ile üst forma iletilir.
 *
 * Kimlik bilgileri tanımlı değilse (configured=false) kutu sessizce devre dışı
 * bir ipucu gösterir — serbest metin girişi (TagInput) her zaman kullanılabilir.
 */
export function IcdSearchInput({
  onSelect,
  existingCodes = [],
}: {
  onSelect: (entry: IcdEntry) => void
  existingCodes?: string[]
}) {
  const t = useT()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<IcdEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [configured, setConfigured] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)

  // Dışarı tıklama ile listeyi kapat
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  // Debounce + iptal edilebilir arama. setState çağrıları async timer
  // callback'inde tutulur — effect gövdesinde senkron setState'ten kaçınmak için.
  useEffect(() => {
    const q = query.trim()
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      if (q.length < 2) {
        setResults([])
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const res = await fetch(`/api/icd/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        })
        const data = (await res.json()) as { configured?: boolean; results?: IcdEntry[] }
        setConfigured(data.configured !== false)
        setResults(data.results ?? [])
      } catch (err) {
        if ((err as Error).name !== "AbortError") setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [query])

  function handleSelect(entry: IcdEntry) {
    onSelect(entry)
    setQuery("")
    setResults([])
    setOpen(false)
  }

  const showDropdown = open && query.trim().length >= 2

  return (
    <div className="relative" ref={containerRef}>
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder={t("patient.form.icd.search_placeholder")}
        className="pl-8"
      />

      {showDropdown && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md overflow-hidden">
          {loading ? (
            <div className="flex items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t("patient.form.icd.searching")}
            </div>
          ) : !configured ? (
            <div className="px-3 py-2.5 text-xs text-muted-foreground">
              {t("patient.form.icd.not_configured")}
            </div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2.5 text-sm text-muted-foreground">
              {t("patient.form.icd.no_results")}
            </div>
          ) : (
            <ul className="max-h-64 overflow-y-auto py-1">
              {results.map((entry) => {
                const already = existingCodes.includes(entry.code)
                return (
                  <li key={entry.code}>
                    <button
                      type="button"
                      disabled={already}
                      onClick={() => handleSelect(entry)}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 font-mono text-xs font-medium text-primary">
                        {entry.code}
                      </span>
                      <span className="flex-1 truncate">{entry.title}</span>
                      {already ? (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {t("patient.form.icd.added")}
                        </span>
                      ) : (
                        <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

// Saf biçimlendirme yardımcıları icd/format.ts'e taşındı — buradan yeniden export
// ediliyor (formları etkilememek için) ve sunucu tarafında da kullanılabiliyor.
export { formatIcdEntry, extractIcdCode } from "@/lib/icd/format"
