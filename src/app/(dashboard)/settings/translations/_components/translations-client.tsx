"use client"

import { useState, useRef, useActionState, useEffect, useMemo } from "react"
import { Search, Pencil, RotateCcw, Check, X, Loader2, BadgeCheck } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { updateTranslationAction, resetTranslationAction } from "@/lib/actions/translations"
import { toast } from "@/store/ui.store"
import type { LangCode } from "@/lib/i18n/languages"

type Entry = {
  key: string
  defaultValue: string
  currentValue: string
  isCustomized: boolean
}

const CATEGORY_LABELS: Record<string, string> = {
  "nav":         "Navigasyon / Navigation",
  "action":      "Aksiyonlar / Actions",
  "common":      "Genel / Common",
  "page":        "Sayfa Başlıkları / Page Titles",
  "status":      "Durumlar / Statuses",
  "type":        "Türler / Types",
  "field":       "Form Alanları / Fields",
  "gender":      "Cinsiyet / Gender",
  "timeline":    "Zaman Çizelgesi / Timeline",
  "diagnosis":   "Tanı / Diagnosis",
  "settings":    "Ayarlar / Settings",
  "notify":      "Bildirimler / Notifications",
  "dashboard":   "Kontrol Paneli / Dashboard",
  "appointment": "Randevular / Appointments",
  "user":        "Kullanıcılar / Users",
  "permission":  "Yetkiler / Permissions",
}

function getCategory(key: string): string {
  const prefix = key.split(".")[0]
  return CATEGORY_LABELS[prefix] ?? prefix
}

function EditRow({
  entry,
  lang,
  onDone,
}: {
  entry: Entry
  lang: LangCode
  onDone: () => void
}) {
  const [updateState, updateAction, updatePending] = useActionState(updateTranslationAction, {})
  const [resetState, resetAction, resetPending] = useActionState(resetTranslationAction, {})
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (updateState?.success) {
      toast.success(updateState.message ?? "Güncellendi.")
      onDone()
    } else if (updateState?.message && !updateState.success) {
      toast.error(updateState.message)
    }
  }, [updateState, onDone])

  useEffect(() => {
    if (resetState?.success) {
      toast.success(resetState.message ?? "Sıfırlandı.")
      onDone()
    } else if (resetState?.message && !resetState.success) {
      toast.error(resetState.message)
    }
  }, [resetState, onDone])

  const isPending = updatePending || resetPending

  return (
    <div className="flex items-center gap-2 w-full">
      <form action={updateAction} className="flex items-center gap-2 flex-1">
        <input type="hidden" name="key" value={entry.key} />
        <input type="hidden" name="lang" value={lang} />
        <Input
          ref={inputRef}
          name="value"
          defaultValue={entry.currentValue}
          autoFocus
          disabled={isPending}
          className="h-8 text-sm flex-1"
          onKeyDown={(e) => {
            if (e.key === "Escape") onDone()
          }}
        />
        <Button type="submit" size="sm" variant="default" disabled={isPending} className="h-8 px-2">
          {updatePending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        </Button>
      </form>

      {entry.isCustomized && (
        <form action={resetAction}>
          <input type="hidden" name="key" value={entry.key} />
          <input type="hidden" name="lang" value={lang} />
          <TooltipProvider>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button type="submit" size="sm" variant="outline" disabled={isPending} className="h-8 px-2">
                  {resetPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Varsayılana döndür: &quot;{entry.defaultValue}&quot;</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </form>
      )}

      <Button
        size="sm"
        variant="ghost"
        disabled={isPending}
        onClick={onDone}
        className="h-8 px-2"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

function TranslationRow({ entry, lang }: { entry: Entry; lang: LangCode }) {
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <div className="grid grid-cols-[1fr_2fr] gap-4 py-2.5 border-b last:border-b-0 items-center">
        <div>
          <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono text-muted-foreground">
            {entry.key}
          </code>
          {entry.isCustomized && (
            <p className="text-xs text-muted-foreground mt-1 truncate">
              Varsayılan: {entry.defaultValue}
            </p>
          )}
        </div>
        <EditRow entry={entry} lang={lang} onDone={() => setEditing(false)} />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-[1fr_2fr] gap-4 py-2.5 border-b last:border-b-0 items-center group">
      <div className="min-w-0">
        <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono text-muted-foreground break-all">
          {entry.key}
        </code>
        {entry.isCustomized && (
          <p className="text-xs text-muted-foreground mt-1 truncate">
            Varsayılan: {entry.defaultValue}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm flex-1 truncate">{entry.currentValue}</span>
        {entry.isCustomized && (
          <Badge variant="secondary" className="text-xs shrink-0 gap-1">
            <BadgeCheck className="h-3 w-3" />
            Özel
          </Badge>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setEditing(true)}
          className="h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

type Props = {
  entries: Entry[]
  lang: LangCode
}

export function TranslationsClient({ entries, lang }: Props) {
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return entries
    return entries.filter(
      (e) =>
        e.key.toLowerCase().includes(q) ||
        e.defaultValue.toLowerCase().includes(q) ||
        e.currentValue.toLowerCase().includes(q)
    )
  }, [entries, search])

  const grouped = useMemo(() => {
    const map = new Map<string, Entry[]>()
    for (const entry of filtered) {
      const cat = getCategory(entry.key)
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(entry)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, "tr"))
  }, [filtered])

  const customizedCount = entries.filter((e) => e.isCustomized).length

  return (
    <div className="space-y-4">
      {/* Search + Stats */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Anahtar veya metin ara..."
            className="pl-9 h-9"
          />
        </div>
        <div className="text-sm text-muted-foreground">
          {filtered.length} / {entries.length} metin
          {customizedCount > 0 && (
            <span className="ml-2 text-primary font-medium">
              · {customizedCount} özelleştirilmiş
            </span>
          )}
        </div>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-[1fr_2fr] gap-4 pb-1 border-b">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Anahtar</p>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Değer</p>
      </div>

      {/* Grouped Entries */}
      {grouped.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Sonuç bulunamadı.</p>
      ) : (
        grouped.map(([category, categoryEntries]) => (
          <div key={category}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1 pt-2">
              {category} ({categoryEntries.length})
            </p>
            <div>
              {categoryEntries.map((entry) => (
                <TranslationRow key={entry.key} entry={entry} lang={lang} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
