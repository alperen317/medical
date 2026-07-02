"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Brain, Loader2, AlertTriangle, Sparkles, Clock, Cpu, Eye, EyeOff, Upload, Check, History, GitCompare, ArrowUp, ArrowDown, Minus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "@/store/ui.store"
import { getBrainAnalysisAction } from "@/lib/actions/brain-tumor"
import type { BrainAnalysis, BrainAnalysisSummary, BrainMetrics, PlaneName } from "@/lib/ai/brain-tumor"

// Alt-bölge etiketleri + renkleri (inference overlay ile aynı renk kodu).
const SUBREGIONS: { key: "wt" | "tc" | "et"; label: string; dot: string; bar: string }[] = [
  { key: "wt", label: "Bütün Tümör (WT)", dot: "bg-green-500", bar: "bg-green-500" },
  { key: "tc", label: "Tümör Çekirdeği (TC)", dot: "bg-amber-500", bar: "bg-amber-500" },
  { key: "et", label: "Kontrastlanan (ET)", dot: "bg-red-500", bar: "bg-red-500" },
]

const PLANES: { key: PlaneName; label: string }[] = [
  { key: "axial", label: "Aksiyel" },
  { key: "coronal", label: "Koronal" },
  { key: "sagittal", label: "Sajital" },
]

// Yükleme akışı için modalite anahtarları + etiketler (BraTS sırası).
const MODALITIES: { key: "flair" | "t1" | "t1c" | "t2"; label: string }[] = [
  { key: "flair", label: "FLAIR" },
  { key: "t1", label: "T1" },
  { key: "t1c", label: "T1c (kontrastlı)" },
  { key: "t2", label: "T2" },
]

type ModalityKey = (typeof MODALITIES)[number]["key"]
type UploadFiles = Record<ModalityKey, File | null>
const EMPTY_UPLOAD: UploadFiles = { flair: null, t1: null, t1c: null, t2: null }

const DEFAULT_OPACITY = 60

// İki analizin karşılaştırma durumu: özetler (tarih + hacim) + tam görüntüleyiciler.
type ComparisonState = {
  base: BrainAnalysisSummary
  follow: BrainAnalysisSummary
  baseFull: BrainAnalysis | null
  followFull: BrainAnalysis | null
}

// %25 eşiği ile kaba yanıt kategorisi (WT hacmi üzerinden).
const PROGRESSION_PCT = 25

export function BrainTumorPanel({
  patientId,
  canRun,
  initialAnalyses = [],
}: {
  patientId: string
  canRun: boolean
  initialAnalyses?: BrainAnalysisSummary[]
}) {
  const router = useRouter()
  const [analysis, setAnalysis] = useState<BrainAnalysis | null>(null)
  // Eski kayıtlar (analysisFile yok) için: tam görüntüleyici yerine statik overlay+hacim.
  const [staticView, setStaticView] = useState<BrainAnalysisSummary | null>(null)
  const [uploadFiles, setUploadFiles] = useState<UploadFiles>(EMPTY_UPLOAD)
  const [uploading, setUploading] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  // Karşılaştırma modu
  const [compareMode, setCompareMode] = useState(false)
  const [compareSel, setCompareSel] = useState<string[]>([])
  const [comparison, setComparison] = useState<ComparisonState | null>(null)
  const [loadingCompare, setLoadingCompare] = useState(false)

  async function handleUpload() {
    const missing = MODALITIES.filter((m) => !uploadFiles[m.key])
    if (missing.length > 0) {
      toast.error(`Eksik modalite: ${missing.map((m) => m.label).join(", ")}`)
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      for (const m of MODALITIES) fd.append(m.key, uploadFiles[m.key] as File)
      const res = await fetch(`/api/patients/${patientId}/brain-tumor`, {
        method: "POST",
        body: fd,
      })
      const data = (await res.json()) as { analysis?: BrainAnalysis; error?: string }
      if (!res.ok || !data.analysis) {
        toast.error(data.error ?? "Analiz başarısız oldu.")
        return
      }
      setStaticView(null)
      setAnalysis(data.analysis)
      setUploadFiles(EMPTY_UPLOAD)
      setUploadOpen(false)
      toast.success("Segmentasyon tamamlandı ve zaman çizelgesine eklendi.")
      // Sunucuyu yenile ki yeni analiz "Geçmiş Analizler" listesine düşsün.
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Yükleme sırasında hata oluştu.")
    } finally {
      setUploading(false)
    }
  }

  // Geçmiş bir analizi gösterir. analysisFile varsa tam interaktif görüntüleyici,
  // yoksa (eski kayıt) statik overlay + hacim/metrik görünümü.
  async function handleView(summary: BrainAnalysisSummary) {
    if (!summary.analysisFile) {
      setAnalysis(null)
      setStaticView(summary)
      return
    }
    setLoadingId(summary.id)
    try {
      const res = await getBrainAnalysisAction(patientId, summary.analysisFile)
      if (res.success) {
        setStaticView(null)
        setAnalysis(res.analysis)
      } else {
        toast.error(res.message)
      }
    } finally {
      setLoadingId(null)
    }
  }

  function toggleCompareMode() {
    setCompareMode((on) => !on)
    setCompareSel([])
    setComparison(null)
    setStaticView(null)
  }

  function toggleSelect(id: string) {
    setCompareSel((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 2) {
        toast.error("En fazla 2 analiz seçebilirsiniz.")
        return prev
      }
      return [...prev, id]
    })
  }

  async function runCompare() {
    if (compareSel.length !== 2) return
    const [b, f] = compareSel
      .map((id) => initialAnalyses.find((a) => a.id === id))
      .filter((a): a is BrainAnalysisSummary => Boolean(a))
      .sort((a, z) => +new Date(a.date) - +new Date(z.date)) // erken = bazal
    setLoadingCompare(true)
    try {
      const [bRes, fRes] = await Promise.all([
        b.analysisFile ? getBrainAnalysisAction(patientId, b.analysisFile) : Promise.resolve(null),
        f.analysisFile ? getBrainAnalysisAction(patientId, f.analysisFile) : Promise.resolve(null),
      ])
      setComparison({
        base: b,
        follow: f,
        baseFull: bRes?.success ? bRes.analysis : null,
        followFull: fRes?.success ? fRes.analysis : null,
      })
    } finally {
      setLoadingCompare(false)
    }
  }

  return (
    <div className="rounded-lg border border-sky-200/70 dark:border-sky-900/50 bg-linear-to-r from-sky-50/60 to-transparent dark:from-sky-950/20">
      {/* Başlık */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 border-b border-sky-100/70 dark:border-sky-900/40">
        <Brain className="h-4 w-4 shrink-0 text-sky-600" />
        <span className="text-sm font-medium">Beyin MR Tümör Analizi</span>
        {canRun && (
          <Button size="sm" onClick={() => setUploadOpen(true)} className="ml-auto h-7 gap-1.5 text-xs">
            <Sparkles className="h-3.5 w-3.5" />
            Yeni Analiz
          </Button>
        )}
      </div>

      <div className="px-3 py-3 space-y-3">
        {/* Boş durum — hiç analiz yok ve görüntülenen bir şey de yok */}
        {initialAnalyses.length === 0 && !analysis && !staticView && (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Brain className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm font-medium">Henüz analiz yok</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              {canRun
                ? "4 modalite MR (FLAIR, T1, T1c, T2) yükleyip ilk segmentasyonu çalıştırın."
                : "Görüntülenecek beyin MR analizi bulunmuyor."}
            </p>
            {canRun && (
              <Button size="sm" onClick={() => setUploadOpen(true)} className="mt-1 gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Yeni Analiz
              </Button>
            )}
          </div>
        )}

        {/* Tek analiz görünümü (karşılaştırma modunda gizli) */}
        {!compareMode && analysis && (
          <div className="grid gap-4 lg:grid-cols-2 pt-1">
            <BrainViewerPane analysis={analysis} />
            <MetricsCard analysis={analysis} />
          </div>
        )}

        {/* Eski kayıt: statik overlay + hacim (interaktif görüntüleyici verisi yok) */}
        {!compareMode && !analysis && staticView && <StaticAnalysisView summary={staticView} />}

        {/* Geçmiş analizler + karşılaştırma */}
        {initialAnalyses.length > 0 && (
          <div className="space-y-2 border-t pt-3">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                <History className="h-3.5 w-3.5" /> Geçmiş Analizler ({initialAnalyses.length})
              </p>
              {initialAnalyses.length >= 2 && (
                <Button
                  size="sm"
                  variant={compareMode ? "default" : "outline"}
                  onClick={toggleCompareMode}
                  className="h-7 gap-1 text-xs"
                >
                  <GitCompare className="h-3.5 w-3.5" />
                  {compareMode ? "Çık" : "Karşılaştır"}
                </Button>
              )}
            </div>

            {compareMode && (
              <div className="flex items-center gap-2 rounded-md border border-dashed px-2 py-1.5 text-xs text-muted-foreground">
                <span>Karşılaştırmak için 2 analiz seçin ({compareSel.length}/2).</span>
                <Button
                  size="sm"
                  onClick={runCompare}
                  disabled={compareSel.length !== 2 || loadingCompare}
                  className="ml-auto h-7 gap-1 text-xs"
                >
                  {loadingCompare ? <Loader2 className="h-3 w-3 animate-spin" /> : <GitCompare className="h-3 w-3" />}
                  Karşılaştır
                </Button>
              </div>
            )}

            {comparison && <ComparisonView comparison={comparison} />}

            <div className="grid gap-2 sm:grid-cols-2">
              {initialAnalyses.map((a) => (
                <HistoryCard
                  key={a.id}
                  summary={a}
                  loading={loadingId === a.id}
                  compareMode={compareMode}
                  selected={compareSel.includes(a.id)}
                  onView={() => handleView(a)}
                  onToggleSelect={() => toggleSelect(a.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Yeni analiz — yükleme + segmentasyon modal içinde */}
      <Dialog open={uploadOpen} onOpenChange={(v) => { if (!uploading) setUploadOpen(v) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Brain className="h-4 w-4 text-sky-600" />
              Yeni MR Analizi
            </DialogTitle>
          </DialogHeader>
          <UploadForm
            files={uploadFiles}
            onFile={(key, file) => setUploadFiles((prev) => ({ ...prev, [key]: file }))}
            onSubmit={handleUpload}
            disabled={!canRun}
            uploading={uploading}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Geçmiş bir analizin özet kartı. Normalde "İncele"; karşılaştırma modunda seçilebilir. */
function HistoryCard({
  summary,
  loading,
  compareMode,
  selected,
  onView,
  onToggleSelect,
}: {
  summary: BrainAnalysisSummary
  loading: boolean
  compareMode: boolean
  selected: boolean
  onView: () => void
  onToggleSelect: () => void
}) {
  const dateStr = new Date(summary.date).toLocaleString("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  })
  return (
    <div
      onClick={compareMode ? onToggleSelect : undefined}
      className={`flex gap-2 rounded-md border p-2 transition-colors ${
        compareMode ? "cursor-pointer hover:bg-muted/40" : ""
      } ${selected ? "border-sky-500 ring-1 ring-sky-500 bg-sky-50/50 dark:bg-sky-950/20" : ""}`}
    >
      <div className="relative shrink-0">
        {summary.overlayUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={summary.overlayUrl}
            alt="Analiz overlay"
            className="h-16 w-16 rounded object-cover bg-black/10"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded bg-muted">
            <Brain className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
        {compareMode && (
          <span
            className={`absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border text-[9px] ${
              selected ? "bg-sky-500 text-white border-sky-500" : "bg-background border-input"
            }`}
          >
            {selected && <Check className="h-3 w-3" />}
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div>
          <p className="text-xs font-medium">{dateStr}</p>
          <p className="text-[11px] text-muted-foreground">
            WT {summary.volumes.wt} · TC {summary.volumes.tc} · ET {summary.volumes.et} ml
          </p>
        </div>
        {!compareMode && (
          <Button
            size="sm"
            variant="outline"
            onClick={onView}
            disabled={loading}
            className="h-7 w-fit gap-1 text-xs"
            title={summary.analysisFile ? "İnteraktif görüntüle" : "Overlay + hacimleri göster (eski kayıt)"}
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />}
            İncele
          </Button>
        )}
      </div>
    </div>
  )
}

/** İki analizi karşılaştırır: hacim değişim tablosu + yanıt göstergesi + yan yana görüntüleyici. */
function ComparisonView({ comparison }: { comparison: ComparisonState }) {
  const { base, follow, baseFull, followFull } = comparison
  const [plane, setPlane] = useState<PlaneName>("axial")
  const [opacity, setOpacity] = useState(DEFAULT_OPACITY)

  const days = Math.round(
    (new Date(follow.date).getTime() - new Date(base.date).getTime()) / 86_400_000,
  )
  const fmt = (d: string) => new Date(d).toLocaleDateString("tr-TR", { dateStyle: "medium" })

  // Kaba yanıt kategorisi — WT hacim % değişimi.
  const wtPct = base.volumes.wt > 0 ? ((follow.volumes.wt - base.volumes.wt) / base.volumes.wt) * 100 : 0
  const response =
    wtPct >= PROGRESSION_PCT
      ? { label: "Büyüme", cls: "bg-red-100 text-red-700 border-red-200", Icon: ArrowUp }
      : wtPct <= -PROGRESSION_PCT
        ? { label: "Küçülme", cls: "bg-green-100 text-green-700 border-green-200", Icon: ArrowDown }
        : { label: "Stabil", cls: "bg-amber-100 text-amber-700 border-amber-200", Icon: Minus }

  const rows = [
    { label: "Bütün Tümör (WT)", dot: "bg-green-500", b: base.volumes.wt, f: follow.volumes.wt, unit: "ml" },
    { label: "Tümör Çekirdeği (TC)", dot: "bg-amber-500", b: base.volumes.tc, f: follow.volumes.tc, unit: "ml" },
    { label: "Kontrastlanan (ET)", dot: "bg-red-500", b: base.volumes.et, f: follow.volumes.et, unit: "ml" },
    // Max çap yalnızca iki kayıtta da metrik varsa (eski kayıtlarda olmayabilir).
    ...(base.metrics && follow.metrics
      ? [{ label: "Max çap", dot: "", b: base.metrics.maxDiameterMm, f: follow.metrics.maxDiameterMm, unit: "mm" }]
      : []),
  ]

  return (
    <div className="space-y-3 rounded-md border bg-muted/20 p-3">
      {/* Başlık + yanıt */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">
          {fmt(base.date)} → {fmt(follow.date)}
        </span>
        <span className="text-xs text-muted-foreground">({days} gün)</span>
        <span className={`ml-auto inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${response.cls}`}>
          <response.Icon className="h-3 w-3" /> {response.label}
        </span>
      </div>

      {/* Hacim değişim tablosu */}
      <div className="overflow-hidden rounded-md border text-xs">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/60 border-b text-muted-foreground">
              <th className="px-2 py-1.5 text-left font-semibold">Bölge</th>
              <th className="px-2 py-1.5 text-right font-semibold">Bazal</th>
              <th className="px-2 py-1.5 text-right font-semibold">Takip</th>
              <th className="px-2 py-1.5 text-right font-semibold">Δ</th>
              <th className="px-2 py-1.5 text-right font-semibold">%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const delta = +(r.f - r.b).toFixed(2)
              const pct = r.b > 0 ? (delta / r.b) * 100 : 0
              const grew = delta > 0.001
              const shrank = delta < -0.001
              const color = grew ? "text-red-600" : shrank ? "text-green-600" : "text-muted-foreground"
              const Arrow = grew ? ArrowUp : shrank ? ArrowDown : Minus
              return (
                <tr key={r.label} className="border-b last:border-0">
                  <td className="px-2 py-1.5">
                    <span className="inline-flex items-center gap-1.5">
                      {r.dot && <span className={`h-2 w-2 rounded-full ${r.dot}`} />}
                      {r.label}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono">{r.b} {r.unit}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{r.f} {r.unit}</td>
                  <td className={`px-2 py-1.5 text-right font-mono ${color}`}>
                    <span className="inline-flex items-center gap-0.5">
                      <Arrow className="h-3 w-3" />
                      {delta > 0 ? "+" : ""}{delta} {r.unit}
                    </span>
                  </td>
                  <td className={`px-2 py-1.5 text-right font-mono ${color}`}>
                    {pct > 0 ? "+" : ""}{pct.toFixed(0)}%
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Yan yana görüntüleyici (her iki kayıtta da tam veri varsa) */}
      {baseFull && followFull ? (
        <div className="space-y-2">
          {/* Ortak düzlem + opaklık */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-md border bg-muted/40 p-0.5 text-xs">
              {PLANES.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPlane(p.key)}
                  className={`rounded px-2 py-1 transition-colors ${
                    plane === p.key ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex flex-1 items-center gap-2 min-w-35">
              <span className="text-[11px] text-muted-foreground">Maske</span>
              <input
                type="range"
                min={0}
                max={100}
                value={opacity}
                onChange={(e) => setOpacity(Number(e.target.value))}
                className="h-1.5 flex-1 cursor-pointer accent-red-500"
              />
              <span className="w-9 text-right font-mono text-[11px] text-muted-foreground">%{opacity}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <ComparePane key={`base-${plane}`} analysis={baseFull} plane={plane} opacity={opacity} label={`Bazal · ${fmt(base.date)}`} />
            <ComparePane key={`follow-${plane}`} analysis={followFull} plane={plane} opacity={opacity} label={`Takip · ${fmt(follow.date)}`} />
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Görsel karşılaştırma yok — seçilen kayıtlardan birinde interaktif görüntüleyici verisi bulunmuyor (eski kayıt).
        </p>
      )}

      {/* Uyarı */}
      <p className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
        <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
        Taramalar birbirine kayıtlı (co-registered) değildir; görseller anatomik olarak birebir hizalı olmayabilir.
        Hacim değişimi kaba bir göstergedir, klinik tanı yerine geçmez.
      </p>
    </div>
  )
}

/** Karşılaştırmada tek taraf: verilen düzlem/opaklıkta, kendi kesit kaydırıcısıyla. */
function ComparePane({
  analysis,
  plane,
  opacity,
  label,
}: {
  analysis: BrainAnalysis
  plane: PlaneName
  opacity: number
  label: string
}) {
  const pd = analysis.viewer.planes[plane]
  const defPos = (() => {
    const p = pd.slices.findIndex((s) => s.index === pd.defaultIndex)
    return p >= 0 ? p : Math.floor(pd.slices.length / 2)
  })()
  const [idx, setIdx] = useState(defPos)
  const slice = pd.slices[Math.min(idx, pd.slices.length - 1)]

  return (
    <div className="space-y-1">
      <p className="truncate text-[11px] font-medium text-muted-foreground">{label}</p>
      <div className="relative overflow-hidden rounded-md border bg-black">
        {slice && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={slice.basePng} alt="Ham MR" className="w-full select-none" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={slice.maskPng}
              alt="Maske"
              className="absolute inset-0 w-full select-none pointer-events-none"
              style={{ opacity: opacity / 100 }}
            />
          </>
        )}
        <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
          kesit {slice?.index}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={Math.max(pd.slices.length - 1, 0)}
        value={Math.min(idx, pd.slices.length - 1)}
        onChange={(e) => setIdx(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer accent-sky-600"
      />
    </div>
  )
}

/** 4 modalite NIfTI yükleyip segmentasyon çalıştıran form (Aşama 2). */
function UploadForm({
  files,
  onFile,
  onSubmit,
  disabled,
  uploading,
}: {
  files: UploadFiles
  onFile: (key: ModalityKey, file: File | null) => void
  onSubmit: () => void
  disabled: boolean
  uploading: boolean
}) {
  const allSelected = MODALITIES.every((m) => files[m.key])

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Aynı hastaya ait, ko-registre (aynı ızgaraya hizalanmış) 4 modalite NIfTI (.nii/.nii.gz) seçin.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {MODALITIES.map((m) => (
          <FilePicker
            key={m.key}
            label={m.label}
            file={files[m.key]}
            disabled={disabled || uploading}
            onChange={(f) => onFile(m.key, f)}
          />
        ))}
      </div>
      <div className="flex items-center gap-2 pt-0.5">
        <Button size="sm" onClick={onSubmit} disabled={disabled || uploading || !allSelected} className="h-8 gap-1.5">
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {uploading ? "Analiz ediliyor…" : "Analiz Et"}
        </Button>
        {uploading && (
          <span className="text-xs text-muted-foreground">{"Yükleme + CPU çıkarımı birkaç dakika sürebilir…"}</span>
        )}
      </div>
    </div>
  )
}

/** Tek modalite için dosya seçici (dosya adı + onay göstergesi). */
function FilePicker({
  label,
  file,
  disabled,
  onChange,
}: {
  label: string
  file: File | null
  disabled: boolean
  onChange: (file: File | null) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div
      className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs ${
        file ? "border-sky-300 bg-sky-50/50 dark:border-sky-800 dark:bg-sky-950/20" : "border-input"
      }`}
    >
      <span className="w-24 shrink-0 font-medium">{label}</span>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className="inline-flex items-center gap-1 rounded border bg-background px-2 py-0.5 hover:bg-muted disabled:opacity-50"
      >
        {file ? <Check className="h-3 w-3 text-sky-600" /> : <Upload className="h-3 w-3" />}
        {file ? "Değiştir" : "Seç"}
      </button>
      <span className="flex-1 truncate text-muted-foreground" title={file?.name}>
        {file?.name ?? "dosya seçilmedi"}
      </span>
      <input
        ref={inputRef}
        type="file"
        accept=".nii,.nii.gz"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </div>
  )
}

/** Çok-düzlemli, kesit + opaklık kaydırıcılı ham↔segment görüntüleyici. */
function BrainViewerPane({ analysis }: { analysis: BrainAnalysis }) {
  const planesData = analysis.viewer.planes

  // Bir düzlemin varsayılan kesitine karşılık gelen slider konumu.
  const defaultPosFor = (p: PlaneName) => {
    const pl = planesData[p]
    const pos = pl.slices.findIndex((s) => s.index === pl.defaultIndex)
    return pos >= 0 ? pos : Math.floor(pl.slices.length / 2)
  }

  const [plane, setPlane] = useState<PlaneName>("axial")
  const [sliceIdx, setSliceIdx] = useState(() => defaultPosFor("axial"))
  const [opacity, setOpacity] = useState(DEFAULT_OPACITY)

  // Düzlem değişince slider'ı o düzlemin varsayılan kesitine hizala.
  function selectPlane(p: PlaneName) {
    setPlane(p)
    setSliceIdx(defaultPosFor(p))
  }

  const current = planesData[plane]
  const slice = current.slices[Math.min(sliceIdx, current.slices.length - 1)]

  return (
    <div className="space-y-2">
      {/* Düzlem sekmeleri */}
      <div className="flex rounded-md border bg-muted/40 p-0.5 text-xs">
        {PLANES.map((p) => (
          <button
            key={p.key}
            onClick={() => selectPlane(p.key)}
            className={`flex-1 rounded px-2 py-1 transition-colors ${
              plane === p.key
                ? "bg-background font-medium shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Katmanlı görüntü: base + maske (CSS opacity) */}
      <div className="relative overflow-hidden rounded-md border bg-black">
        {slice && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={slice.basePng} alt="Ham MR kesiti" className="w-full select-none" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={slice.maskPng}
              alt="Tümör maskesi"
              className="absolute inset-0 w-full select-none pointer-events-none"
              style={{ opacity: opacity / 100 }}
            />
          </>
        )}
        <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
          {PLANES.find((p) => p.key === plane)?.label} · kesit {slice?.index}
        </span>
      </div>

      {/* Kesit kaydırıcı */}
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-[11px] text-muted-foreground">Kesit</span>
        <input
          type="range"
          min={0}
          max={Math.max(current.slices.length - 1, 0)}
          value={Math.min(sliceIdx, current.slices.length - 1)}
          onChange={(e) => setSliceIdx(Number(e.target.value))}
          className="h-1.5 flex-1 cursor-pointer accent-sky-600"
        />
        <span className="w-14 shrink-0 text-right font-mono text-[11px] text-muted-foreground">
          {Math.min(sliceIdx, current.slices.length - 1) + 1}/{current.slices.length}
        </span>
      </div>

      {/* Opaklık kaydırıcı + göster/gizle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpacity((o) => (o > 0 ? 0 : DEFAULT_OPACITY))}
          className="flex w-16 shrink-0 items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          {opacity > 0 ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          Maske
        </button>
        <input
          type="range"
          min={0}
          max={100}
          value={opacity}
          onChange={(e) => setOpacity(Number(e.target.value))}
          className="h-1.5 flex-1 cursor-pointer accent-red-500"
        />
        <span className="w-14 shrink-0 text-right font-mono text-[11px] text-muted-foreground">
          %{opacity}
        </span>
      </div>

      {/* Renk göstergesi */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 pt-0.5">
        {SUBREGIONS.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className={`h-2 w-2 rounded-full ${s.dot}`} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Hacim rozetleri + WT'ye oranlı bar + zenginleştirilmiş metrikler. */
function MetricsCard({ analysis }: { analysis: BrainAnalysis }) {
  const { volumes, metrics } = analysis
  const maxVol = Math.max(volumes.wt, volumes.tc, volumes.et, 1e-6)

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
          Tümör Hacimleri
        </p>
        {SUBREGIONS.map((s) => (
          <div key={s.key} className="space-y-1">
            <div className="flex items-center gap-2 text-sm">
              <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />
              <span className="flex-1">{s.label}</span>
              <span className="font-mono font-medium">{volumes[s.key]} ml</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${s.bar}`}
                style={{ width: `${(volumes[s.key] / maxVol) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 border-t pt-2">
        <Metric label="Beyin hacmi" value={`${metrics.brainMl} ml`} />
        <Metric label="WT / beyin" value={`%${metrics.wtPctOfBrain}`} />
        <Metric label="Max çap" value={`${metrics.maxDiameterMm} mm`} />
      </div>

      <div className="flex items-center gap-3 pt-0.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Cpu className="h-3 w-3" />{analysis.device}</span>
        <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{(analysis.elapsedMs / 1000).toFixed(1)} sn</span>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/30 px-2 py-1.5">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="font-mono text-sm font-medium">{value}</p>
    </div>
  )
}

/** Eski kayıt görünümü: kaydedilmiş overlay + hacim/metrik (interaktif görüntüleyici yok). */
function StaticAnalysisView({ summary }: { summary: BrainAnalysisSummary }) {
  const maxVol = Math.max(summary.volumes.wt, summary.volumes.tc, summary.volumes.et, 1e-6)
  return (
    <div className="grid gap-4 lg:grid-cols-2 pt-1">
      <div className="overflow-hidden rounded-md border bg-black">
        {summary.overlayUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={summary.overlayUrl} alt="Analiz overlay" className="w-full" />
        ) : (
          <div className="flex aspect-square items-center justify-center">
            <Brain className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="space-y-3">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
          Tümör Hacimleri
        </p>
        {SUBREGIONS.map((s) => (
          <div key={s.key} className="space-y-1">
            <div className="flex items-center gap-2 text-sm">
              <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />
              <span className="flex-1">{s.label}</span>
              <span className="font-mono font-medium">{summary.volumes[s.key]} ml</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${(summary.volumes[s.key] / maxVol) * 100}%` }} />
            </div>
          </div>
        ))}
        {summary.metrics && (
          <div className="grid grid-cols-3 gap-2 border-t pt-2">
            <Metric label="Beyin hacmi" value={`${summary.metrics.brainMl} ml`} />
            <Metric label="WT / beyin" value={`%${summary.metrics.wtPctOfBrain}`} />
            <Metric label="Max çap" value={`${summary.metrics.maxDiameterMm} mm`} />
          </div>
        )}
        <p className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
          <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
          Bu kayıt interaktif görüntüleyici verisi olmadan kaydedilmiş (eski). Overlay + hacimler
          gösteriliyor; kesit/düzlem kaydırıcıları yalnızca yeni analizlerde mevcut.
        </p>
      </div>
    </div>
  )
}

/**
 * Zaman çizelgesindeki bir MR analiz kaydı için "Görüntüle" butonu + modal.
 * analysisFile varsa tam interaktif görüntüleyiciyi (kesit/maske/düzlem) diskten
 * yükler; yoksa (eski kayıt) statik overlay + hacim gösterir.
 */
export function TimelineBrainViewerButton({
  patientId,
  title,
  overlayUrl,
  analysisFile,
  volumes,
  metrics,
}: {
  patientId: string
  title: string
  overlayUrl: string | null
  analysisFile: string | null
  volumes: { tc: number; wt: number; et: number }
  metrics: BrainMetrics | null
}) {
  const [open, setOpen] = useState(false)
  const [analysis, setAnalysis] = useState<BrainAnalysis | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleOpen() {
    setOpen(true)
    if (analysisFile && !analysis) {
      setLoading(true)
      try {
        const res = await getBrainAnalysisAction(patientId, analysisFile)
        if (res.success) setAnalysis(res.analysis)
        else toast.error(res.message)
      } finally {
        setLoading(false)
      }
    }
  }

  const summary: BrainAnalysisSummary = {
    id: "",
    date: "",
    volumes,
    metrics,
    source: "",
    overlayUrl,
    analysisFile,
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex items-center gap-1.5 rounded-md border bg-background/60 px-2 py-1 text-xs hover:bg-background transition-colors"
      >
        <Brain className="h-3 w-3 text-sky-600" />
        Görüntüle
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl w-[95vw] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Brain className="h-4 w-4 text-sky-600" />
              {title}
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Görüntüleyici yükleniyor…
            </div>
          ) : analysis ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <BrainViewerPane analysis={analysis} />
              <MetricsCard analysis={analysis} />
            </div>
          ) : (
            <StaticAnalysisView summary={summary} />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
