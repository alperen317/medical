"use client"

import { useState, useTransition } from "react"
import {
  BrainCircuit, Loader2, TrendingUp, TrendingDown, Minus,
  AlertTriangle, Plus, Sparkles, Check, RotateCw, ChevronRight, Tag,
  ThumbsUp, ThumbsDown, Send,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet"
import { AiReportText } from "@/components/documents/documents-section"
import {
  preparePatientSummaryAction, generatePatientSummaryAction, applyIcdSuggestionAction, rateSummaryAction,
} from "@/lib/actions/ai-summary"
import { toast } from "@/store/ui.store"
import { useT } from "@/store/translations-context"
import { format } from "date-fns"
import { tr } from "date-fns/locale"

type TrendDirection = "rising" | "falling" | "stable"
type LabStatus = "normal" | "high" | "low" | "critical"

type Trend = {
  name: string
  unit: string
  direction: TrendDirection
  latestStatus: LabStatus
  series: { date: string; value: number }[]
}
type Interaction = { medication: string; conflictsWith: string }
type IcdSuggestion = { code: string; title: string }

export type AiSummaryData = {
  trends?: Trend[]
  interactions?: Interaction[]
  suggestedIcd?: IcdSuggestion[]
}

const DIR_META: Record<TrendDirection, { icon: typeof TrendingUp; cls: string }> = {
  rising:  { icon: TrendingUp,   cls: "text-red-600 dark:text-red-400" },
  falling: { icon: TrendingDown, cls: "text-blue-600 dark:text-blue-400" },
  stable:  { icon: Minus,        cls: "text-muted-foreground" },
}

const STATUS_CLS: Record<LabStatus, string> = {
  critical: "text-red-600 dark:text-red-400",
  high:     "text-amber-600 dark:text-amber-400",
  low:      "text-blue-600 dark:text-blue-400",
  normal:   "text-emerald-600 dark:text-emerald-400",
}

// Yapısal 👎 nedenleri — kodlar DB'ye, etiketler i18n'den gelir.
const REASON_CODES = ["hallucination", "missed_finding", "wrong_tone", "unsafe", "other"] as const

export function ClinicalSummaryPanel({
  patientId,
  canGenerate,
  summary,
  summaryData,
  generatedAt,
}: {
  patientId: string
  canGenerate: boolean
  summary: string | null
  summaryData: AiSummaryData | null
  generatedAt: string | null
}) {
  const t = useT()
  const [pending, startTransition] = useTransition()
  const [addedCodes, setAddedCodes] = useState<string[]>([])
  const [addingCode, setAddingCode] = useState<string | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [payload, setPayload] = useState("")
  const [sheetOpen, setSheetOpen] = useState(false)
  const [rateVerdict, setRateVerdict] = useState<number | null>(null)
  const [rateComment, setRateComment] = useState("")
  const [rateReasons, setRateReasons] = useState<string[]>([])
  const [rateCorrected, setRateCorrected] = useState("")
  const [rated, setRated] = useState(false)

  const trends = (summaryData?.trends ?? []).filter((tr) => tr.direction !== "stable" || tr.latestStatus !== "normal")
  const interactions = summaryData?.interactions ?? []
  const suggestions = summaryData?.suggestedIcd ?? []
  const hasContent = Boolean(summary) || trends.length > 0 || interactions.length > 0 || suggestions.length > 0

  // Adım 1: LLM'e gidecek veriyi hazırla (LLM çağrılmaz) ve onaya sun.
  function handlePrepare() {
    setPreparing(true)
    startTransition(async () => {
      const res = await preparePatientSummaryAction(patientId)
      setPreparing(false)
      if (res.success) {
        setPayload(res.payload)
        setPreviewOpen(true)
      } else {
        toast.error(res.message ?? t("ai.summary.error"))
      }
    })
  }

  // Adım 2: Onaylanan (gerekirse düzenlenen) metni LLM'e gönder ve üret.
  function handleConfirmGenerate() {
    startTransition(async () => {
      const res = await generatePatientSummaryAction(patientId, payload)
      if (res.success) {
        toast.success(t("ai.summary.generated"))
        setPreviewOpen(false)
        setSheetOpen(true)
      } else {
        toast.error(res.message ?? t("ai.summary.error"))
      }
    })
  }

  function handleAddIcd(entry: IcdSuggestion) {
    setAddingCode(entry.code)
    startTransition(async () => {
      const res = await applyIcdSuggestionAction(patientId, entry)
      if (res.success) {
        setAddedCodes((prev) => [...prev, entry.code])
        toast.success(t("ai.summary.icd_added"))
      } else {
        toast.error(res.message ?? t("ai.summary.error"))
      }
      setAddingCode(null)
    })
  }

  function handleSubmitRate() {
    if (rateVerdict === null) return
    const down = rateVerdict === -1
    startTransition(async () => {
      const res = await rateSummaryAction(patientId, {
        rating: rateVerdict,
        comment: rateComment,
        correctedResult: down ? rateCorrected : undefined,
        reasons: down ? rateReasons : undefined,
      })
      if (res.success) {
        setRated(true)
        toast.success(t("ai.summary.rate_thanks"))
      } else {
        toast.error(res.message ?? t("ai.summary.error"))
      }
    })
  }

  function toggleReason(code: string) {
    setRateReasons((prev) => prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code])
  }

  // Sheet her açıldığında puanlama durumunu sıfırla (yeni oturum = yeni değerlendirme)
  function handleSheetOpenChange(open: boolean) {
    setSheetOpen(open)
    if (open) {
      setRated(false); setRateVerdict(null); setRateComment("")
      setRateReasons([]); setRateCorrected("")
    }
  }

  const genBusy = pending || preparing

  return (
    <>
      {/* Kompakt şerit — her zaman görünür, tek satır */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-violet-200/70 dark:border-violet-900/50 bg-linear-to-r from-violet-50/60 to-transparent dark:from-violet-950/20 px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <BrainCircuit className="h-4 w-4 shrink-0 text-violet-600" />
          <span className="text-sm font-medium">{t("ai.summary.title")}</span>
          <span className="text-xs text-muted-foreground truncate">
            {generatedAt
              ? `· ${format(new Date(generatedAt), "d MMM HH:mm", { locale: tr })}`
              : `· ${t("ai.summary.not_generated")}`}
          </span>
        </div>

        {/* Sinyal rozetleri */}
        {hasContent && (
          <div className="flex items-center gap-1.5">
            {interactions.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3" />
                {interactions.length} {t("ai.summary.conflicts")}
              </span>
            )}
            {trends.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                <TrendingUp className="h-3 w-3" />
                {trends.length} trend
              </span>
            )}
            {suggestions.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                <Tag className="h-3 w-3" />
                {suggestions.length} ICD
              </span>
            )}
          </div>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {hasContent && (
            <Button size="sm" variant="ghost" onClick={() => setSheetOpen(true)} className="h-7 gap-1 px-2 text-violet-700 dark:text-violet-400 hover:text-violet-800 hover:bg-violet-100/60 dark:hover:bg-violet-950/40">
              {t("ai.summary.detail")}
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          )}
          {canGenerate && (
            hasContent ? (
              <Button size="sm" variant="outline" onClick={handlePrepare} disabled={genBusy} className="h-7 w-7 p-0" title={t("ai.summary.regenerate")}>
                {genBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={handlePrepare} disabled={genBusy} className="h-7 gap-1.5">
                {genBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {t("ai.summary.generate")}
              </Button>
            )
          )}
        </div>
      </div>

      {/* Detay — sağdan açılan panel */}
      <Sheet open={sheetOpen} onOpenChange={handleSheetOpenChange}>
        <SheetContent className="w-full sm:max-w-xl lg:max-w-2xl">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <BrainCircuit className="h-4 w-4 text-violet-600" />
              {t("ai.summary.title")}
            </SheetTitle>
            <SheetDescription>
              {generatedAt
                ? `${t("ai.summary.last_generated")}: ${format(new Date(generatedAt), "d MMM yyyy, HH:mm", { locale: tr })}`
                : t("ai.summary.sheet_desc")}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* İlaç–alerji çakışmaları */}
            {interactions.length > 0 && (
              <div className="space-y-2">
                {interactions.map((i, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30 px-3 py-2 text-sm"
                  >
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                    <span>
                      <span className="font-medium">{i.medication}</span>
                      {" "}↔ {t("ai.summary.allergy")}: <span className="font-medium">{i.conflictsWith}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* AI klinik özet metni */}
            {summary && (
              <div className="rounded-md border border-violet-100 bg-violet-50/40 dark:border-violet-900/50 dark:bg-violet-950/20 px-4 py-3">
                <AiReportText text={summary} />
              </div>
            )}

            {/* Trendler */}
            {trends.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  {t("ai.summary.trends")}
                </p>
                <div className="space-y-1.5">
                  {trends.map((tr, idx) => {
                    const { icon: Icon, cls } = DIR_META[tr.direction]
                    return (
                      <div key={idx} className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
                        <Icon className={`h-4 w-4 shrink-0 ${cls}`} />
                        <span className="flex-1 truncate">{tr.name}</span>
                        <span className={`font-mono text-xs ${STATUS_CLS[tr.latestStatus]}`}>
                          {tr.series.map((s) => s.value).join(" → ")}{tr.unit ? ` ${tr.unit}` : ""}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ICD-11 önerileri */}
            {suggestions.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  {t("ai.summary.icd_suggestions")}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map((s) => {
                    const added = addedCodes.includes(s.code)
                    return (
                      <Badge key={s.code} variant="secondary" className="flex items-center gap-1.5 pl-2 pr-1 py-1 font-normal">
                        <span className="font-mono text-xs text-primary">{s.code}</span>
                        <span className="max-w-44 truncate">{s.title}</span>
                        {added ? (
                          <span className="flex items-center gap-0.5 px-1 text-emerald-600">
                            <Check className="h-3 w-3" />
                          </span>
                        ) : canGenerate ? (
                          <button
                            type="button"
                            onClick={() => handleAddIcd(s)}
                            disabled={addingCode === s.code}
                            className="flex items-center rounded-sm p-0.5 hover:bg-background transition-colors disabled:opacity-50"
                            title={t("ai.summary.add_icd")}
                          >
                            {addingCode === s.code
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <Plus className="h-3 w-3" />}
                          </button>
                        ) : null}
                      </Badge>
                    )
                  })}
                </div>
              </div>
            )}

            {!hasContent && (
              <div className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                {canGenerate ? t("ai.summary.empty") : t("ai.summary.empty_no_perm")}
              </div>
            )}
          </div>

          {(summary || canGenerate) && (
            <div className="border-t px-5 py-3 space-y-3">
              {/* Puanlama — AI özetine geri bildirim */}
              {summary && (
                rated ? (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    {t("ai.summary.rate_thanks")}
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{t("ai.summary.rate_question")}</span>
                      <div className="ml-auto flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setRateVerdict(1)}
                          className={`rounded-md border p-1.5 transition-colors ${rateVerdict === 1 ? "border-emerald-300 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40" : "hover:bg-muted text-muted-foreground"}`}
                          title={t("ai.summary.rate_helpful")}
                        >
                          <ThumbsUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setRateVerdict(-1)}
                          className={`rounded-md border p-1.5 transition-colors ${rateVerdict === -1 ? "border-red-300 bg-red-50 text-red-600 dark:bg-red-950/40" : "hover:bg-muted text-muted-foreground"}`}
                          title={t("ai.summary.rate_not_helpful")}
                        >
                          <ThumbsDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    {rateVerdict !== null && (
                      <div className="space-y-2">
                        {/* 👎 → yapısal nedenler + ideal çıktı (altın SFT verisi) */}
                        {rateVerdict === -1 && (
                          <>
                            <div className="flex flex-wrap gap-1">
                              {REASON_CODES.map((code) => {
                                const active = rateReasons.includes(code)
                                return (
                                  <button
                                    key={code}
                                    type="button"
                                    onClick={() => toggleReason(code)}
                                    className={`rounded-full border px-2 py-0.5 text-xs transition-colors ${active ? "border-red-300 bg-red-50 text-red-600 dark:bg-red-950/40" : "hover:bg-muted text-muted-foreground"}`}
                                  >
                                    {t(`ai.summary.reason.${code}` as Parameters<typeof t>[0])}
                                  </button>
                                )
                              })}
                            </div>
                            <textarea
                              value={rateCorrected}
                              onChange={(e) => setRateCorrected(e.target.value)}
                              rows={3}
                              placeholder={t("ai.summary.rate_corrected_placeholder")}
                              className="w-full resize-none rounded-md border border-input bg-background px-2.5 py-1.5 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            />
                          </>
                        )}
                        <div className="flex items-start gap-2">
                          <textarea
                            value={rateComment}
                            onChange={(e) => setRateComment(e.target.value)}
                            rows={2}
                            placeholder={t("ai.summary.rate_comment_placeholder")}
                            className="flex-1 resize-none rounded-md border border-input bg-background px-2.5 py-1.5 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          />
                          <Button size="sm" onClick={handleSubmitRate} disabled={pending} className="h-8 gap-1.5 shrink-0">
                            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                            {t("ai.summary.rate_submit")}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              )}

              {canGenerate && (
                <Button onClick={handlePrepare} disabled={genBusy} variant={summary ? "outline" : "default"} className="w-full gap-2">
                  {genBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {hasContent ? t("ai.summary.regenerate") : t("ai.summary.generate")}
                </Button>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Önizle-onayla: LLM'e gitmeden önce gönderilecek veriyi göster/düzenle */}
      <Dialog open={previewOpen} onOpenChange={(v) => { if (!pending) setPreviewOpen(v) }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("ai.summary.preview_title")}</DialogTitle>
            <DialogDescription>{t("ai.summary.preview_desc")}</DialogDescription>
          </DialogHeader>
          <textarea
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            disabled={pending}
            spellCheck={false}
            className="h-72 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-xs leading-relaxed font-mono shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 whitespace-pre-wrap"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)} disabled={pending}>
              {t("action.cancel")}
            </Button>
            <Button onClick={handleConfirmGenerate} disabled={pending} className="gap-2">
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("ai.summary.confirm_generate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
