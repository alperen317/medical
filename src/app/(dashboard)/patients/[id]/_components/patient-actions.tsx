"use client"

import { useActionState, useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import {
  Plus, Stethoscope, Loader2, X,
  Microscope, Pill, FileText, Paperclip, ClipboardList, FlaskConical, Calendar,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { createTimelineEventAction, type TimelineEventFormState } from "@/lib/actions/timeline"
import { toast } from "@/store/ui.store"

type EventType = "visit" | "diagnosis" | "treatment" | "note" | "document" | "prescription" | "lab"
type MetaField = { key: string; value: string }

const EVENT_TYPES: {
  value: EventType
  label: string
  icon: React.ElementType
  stripe: string
  chipBg: string
  chipText: string
}[] = [
  { value: "visit",        label: "Muayene",    icon: Stethoscope,   stripe: "bg-blue-500",   chipBg: "bg-blue-50 dark:bg-blue-950/40",     chipText: "text-blue-700 dark:text-blue-400"     },
  { value: "diagnosis",    label: "Tanı",       icon: Microscope,    stripe: "bg-amber-500",  chipBg: "bg-amber-50 dark:bg-amber-950/40",   chipText: "text-amber-700 dark:text-amber-400"   },
  { value: "treatment",    label: "Tedavi",     icon: Pill,          stripe: "bg-teal-500",   chipBg: "bg-teal-50 dark:bg-teal-950/40",     chipText: "text-teal-700 dark:text-teal-400"     },
  { value: "note",         label: "Not",        icon: FileText,      stripe: "bg-slate-400",  chipBg: "bg-slate-50 dark:bg-slate-800",      chipText: "text-slate-700 dark:text-slate-400"   },
  { value: "document",     label: "Belge",      icon: Paperclip,     stripe: "bg-purple-500", chipBg: "bg-purple-50 dark:bg-purple-950/40", chipText: "text-purple-700 dark:text-purple-400" },
  { value: "prescription", label: "Reçete",     icon: ClipboardList, stripe: "bg-green-500",  chipBg: "bg-green-50 dark:bg-green-950/40",   chipText: "text-green-700 dark:text-green-400"   },
  { value: "lab",          label: "Lab",        icon: FlaskConical,  stripe: "bg-rose-500",   chipBg: "bg-rose-50 dark:bg-rose-950/40",     chipText: "text-rose-700 dark:text-rose-400"     },
]

const DESCRIPTION_HINTS: Record<EventType, string> = {
  visit:        "Muayene bulgularını, şikayetleri ve gözlemleri aktarın...",
  diagnosis:    "Tanı gerekçesini ve klinik bulgularını açıklayın...",
  treatment:    "Uygulanan tedavi yöntemi ve protokolünü aktarın...",
  note:         "Hasta hakkında klinik notunuzu girin...",
  document:     "Belgenin içeriğini veya önemli noktaları özetleyin...",
  prescription: "Reçetede yer alan ilaçları ve dozajları belirtin...",
  lab:          "Laboratuvar sonuçlarını ve klinik yorumu aktarın...",
}

function FieldError({ errors, field }: { errors?: Record<string, string[]>; field: string }) {
  const msgs = errors?.[field]
  if (!msgs?.length) return null
  return <p className="text-xs text-destructive mt-1">{msgs[0]}</p>
}

export function PatientActions({ patientId }: { patientId: string }) {
  const [open, setOpen] = useState(false)
  const [lockedType, setLockedType] = useState<EventType | null>(null)
  const [selectedType, setSelectedType] = useState<EventType | null>(null)
  const [metaFields, setMetaFields] = useState<MetaField[]>([])
  const [formKey, setFormKey] = useState(0)
  const dateRef = useRef<HTMLInputElement>(null)

  const boundAction = createTimelineEventAction.bind(null, patientId)
  const [state, action, pending] = useActionState<TimelineEventFormState, FormData>(boundAction, {})

  useEffect(() => {
    if (state.success) {
      toast.success("Kayıt başarıyla eklendi")
      setOpen(false)
    }
  }, [state])

  function openDialog(type: EventType | null) {
    setLockedType(type)
    setSelectedType(type)
    setMetaFields([])
    setFormKey((k) => k + 1)
    setOpen(true)
  }

  function closeDialog() {
    setOpen(false)
    setMetaFields([])
  }

  function updateMeta(i: number, field: keyof MetaField, val: string) {
    setMetaFields((prev) => prev.map((f, idx) => (idx === i ? { ...f, [field]: val } : f)))
  }

  const metadataJson = JSON.stringify(
    Object.fromEntries(
      metaFields.filter((f) => f.key.trim()).map((f) => [f.key.trim(), f.value])
    )
  )

  const nowLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16)

  const activeType = EVENT_TYPES.find((t) => t.value === selectedType)

  return (
    <>
      <Button variant="outline" size="sm" className="gap-2" onClick={() => openDialog(null)}>
        <Plus className="h-4 w-4" />
        Yeni Kayıt
      </Button>
      <Button size="sm" className="gap-2" onClick={() => openDialog("visit")}>
        <Stethoscope className="h-4 w-4" />
        Muayene Başlat
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) closeDialog(); else setOpen(true) }}>
        <DialogContent className="max-w-lg flex flex-col max-h-[90vh] p-0 gap-0 overflow-hidden">

          {/* Coloured stripe — the only bold gesture, shifts per type */}
          <div className={cn("h-0.75 w-full shrink-0 transition-colors duration-300", activeType?.stripe ?? "bg-border")} />

          {/* Header */}
          <div className="px-6 pt-5 pb-3 shrink-0">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold leading-none">
                {lockedType === "visit" ? "Muayene Kaydı" : "Yeni Kayıt"}
              </DialogTitle>
              <DialogDescription className="text-xs mt-1">
                Zaman çizelgesine eklenir — kaydedildiğinde geri alınamaz.
              </DialogDescription>
            </DialogHeader>
          </div>

          <Separator />

          {/* Scrollable form body */}
          <form key={formKey} action={action} className="flex flex-col flex-1 overflow-hidden">
            <input type="hidden" name="metadata" value={metadataJson} />
            <input type="hidden" name="type" value={selectedType ?? ""} />

            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

              {state.message && !state.success && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                  {state.message}
                </div>
              )}

              {/* Kayıt Tipi — chip selector */}
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                  Kayıt Tipi <span className="text-destructive">*</span>
                </p>

                {lockedType ? (
                  /* Locked: single chip, visually selected */
                  <div className="flex">
                    {(() => {
                      const t = EVENT_TYPES.find((t) => t.value === lockedType)!
                      const Icon = t.icon
                      return (
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-current",
                          t.chipBg, t.chipText
                        )}>
                          <Icon className="h-3.5 w-3.5" />
                          {t.label}
                        </span>
                      )
                    })()}
                  </div>
                ) : (
                  /* Free selection: all chips */
                  <div className="flex flex-wrap gap-1.5">
                    {EVENT_TYPES.map((t) => {
                      const Icon = t.icon
                      const isSelected = selectedType === t.value
                      return (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => setSelectedType(t.value)}
                          className={cn(
                            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            isSelected
                              ? cn(t.chipBg, t.chipText, "border-current ring-1 ring-current ring-offset-1")
                              : "bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {t.label}
                        </button>
                      )
                    })}
                  </div>
                )}
                <FieldError errors={state.errors} field="type" />
              </div>

              {/* Başlık */}
              <div className="space-y-1.5">
                <label htmlFor="title" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                  Başlık <span className="text-destructive">*</span>
                </label>
                <Input
                  id="title"
                  name="title"
                  placeholder={lockedType === "visit" ? "Muayene" : "Kısa ve açıklayıcı bir başlık..."}
                  defaultValue={lockedType === "visit" ? "Muayene" : ""}
                />
                <FieldError errors={state.errors} field="title" />
              </div>

              {/* Açıklama */}
              <div className="space-y-1.5">
                <label htmlFor="description" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                  Açıklama <span className="text-destructive">*</span>
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={3}
                  placeholder={
                    selectedType
                      ? DESCRIPTION_HINTS[selectedType]
                      : "Kayıt detaylarını girin..."
                  }
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 min-h-20 resize-none"
                />
                <FieldError errors={state.errors} field="description" />
              </div>

              {/* Tarih & Saat */}
              <div className="space-y-1.5">
                <label htmlFor="date" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                  Tarih & Saat <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <input
                    ref={dateRef}
                    id="date"
                    name="date"
                    type="datetime-local"
                    defaultValue={nowLocal}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 pr-10 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&::-webkit-calendar-picker-indicator]:hidden"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => dateRef.current?.showPicker()}
                    className="absolute inset-y-0 right-0 left-[60%] flex items-center justify-end px-3 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none cursor-pointer"
                  >
                    <Calendar className="h-4 w-4" />
                  </button>
                </div>
                <FieldError errors={state.errors} field="date" />
              </div>

              {/* Ek Alanlar */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Separator className="flex-1" />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest shrink-0">
                    Ek Alanlar
                  </span>
                  <Separator className="flex-1" />
                </div>

                {metaFields.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => setMetaFields([{ key: "", value: "" }])}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:border-foreground/40 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Lab değeri veya ölçüm ekle (HbA1c, tansiyon...)
                  </button>
                ) : (
                  <div className="space-y-2">
                    {metaFields.map((field, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <Input
                          placeholder="Alan (örn. HbA1c)"
                          value={field.key}
                          onChange={(e) => updateMeta(i, "key", e.target.value)}
                          className="flex-1"
                        />
                        <Input
                          placeholder="Değer (örn. %7.8)"
                          value={field.value}
                          onChange={(e) => updateMeta(i, "value", e.target.value)}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => setMetaFields((prev) => prev.filter((_, idx) => idx !== i))}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => setMetaFields((prev) => [...prev, { key: "", value: "" }])}
                    >
                      <Plus className="h-3 w-3" />
                      Alan Ekle
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Sticky footer */}
            <div className="shrink-0 border-t px-6 py-4 flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground">
                <span className="text-destructive">*</span> zorunlu alan
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={closeDialog}>
                  İptal
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={pending || !selectedType}
                  className="gap-2 min-w-28"
                >
                  {pending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Kaydediliyor...
                    </>
                  ) : (
                    "Kayıt Ekle"
                  )}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
