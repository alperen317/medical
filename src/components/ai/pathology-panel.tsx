"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Microscope, Loader2, AlertTriangle, Sparkles, Clock, Cpu, Eye, EyeOff, Upload, Check, History, Maximize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "@/store/ui.store"
import type { PathologyAnalysis } from "@/lib/ai/pathology"

const DEFAULT_OPACITY = 60

export function PathologyPanel({
  patientId,
  canRun,
  initialAnalyses = [],
}: {
  patientId: string
  canRun: boolean
  initialAnalyses?: PathologyAnalysis[]
}) {
  const router = useRouter()
  const [current, setCurrent] = useState<PathologyAnalysis | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleUpload() {
    if (!file) {
      toast.error("Bir WSI dosyası seçin.")
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch(`/api/patients/${patientId}/pathology`, {
        method: "POST",
        body: fd,
      })
      const data = (await res.json()) as { analysis?: PathologyAnalysis; error?: string }
      if (!res.ok || !data.analysis) {
        toast.error(data.error ?? "Analiz başarısız oldu.")
        return
      }
      setCurrent(data.analysis)
      setFile(null)
      setUploadOpen(false)
      toast.success("Tümör tespiti tamamlandı ve zaman çizelgesine eklendi.")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Yükleme sırasında hata oluştu.")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="rounded-lg border border-violet-200/70 dark:border-violet-900/50 bg-linear-to-r from-violet-50/60 to-transparent dark:from-violet-950/20">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 border-b border-violet-100/70 dark:border-violet-900/40">
        <Microscope className="h-4 w-4 shrink-0 text-violet-600" />
        <span className="text-sm font-medium">Patoloji Tümör Tespiti</span>
        {canRun && (
          <Button size="sm" onClick={() => setUploadOpen(true)} className="ml-auto h-7 gap-1.5 text-xs">
            <Sparkles className="h-3.5 w-3.5" />
            Yeni Analiz
          </Button>
        )}
      </div>

      <div className="px-3 py-3 space-y-3">
        {initialAnalyses.length === 0 && !current && (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Microscope className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm font-medium">Henüz analiz yok</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              {canRun
                ? "Bir doku kesiti WSI dosyası (.tif/.tiff/.svs/.ndpi) yükleyip ilk tespiti çalıştırın."
                : "Görüntülenecek patoloji analizi bulunmuyor."}
            </p>
            {canRun && (
              <Button size="sm" onClick={() => setUploadOpen(true)} className="mt-1 gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Yeni Analiz
              </Button>
            )}
          </div>
        )}

        {current && (
          <div className="grid gap-4 lg:grid-cols-2 pt-1">
            <HeatmapViewer analysis={current} />
            <MetricsCard analysis={current} />
          </div>
        )}

        {initialAnalyses.length > 0 && (
          <div className="space-y-2 border-t pt-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              <History className="h-3.5 w-3.5" /> Geçmiş Analizler ({initialAnalyses.length})
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {initialAnalyses.map((a) => (
                <HistoryCard key={a.id} analysis={a} onView={() => setCurrent(a)} />
              ))}
            </div>
          </div>
        )}
      </div>

      <Dialog open={uploadOpen} onOpenChange={(v) => { if (!uploading) setUploadOpen(v) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Microscope className="h-4 w-4 text-violet-600" />
              Yeni Patoloji Analizi
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Bir whole-slide image (WSI) dosyası seçin. WSI&apos;lar büyük olabilir (yüzlerce MB - birkaç GB) ve CPU&apos;da analiz dakikalar sürebilir.
            </p>
            <div
              className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs ${
                file ? "border-violet-300 bg-violet-50/50 dark:border-violet-800 dark:bg-violet-950/20" : "border-input"
              }`}
            >
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-1 rounded border bg-background px-2 py-0.5 hover:bg-muted disabled:opacity-50"
              >
                {file ? <Check className="h-3 w-3 text-violet-600" /> : <Upload className="h-3 w-3" />}
                {file ? "Değiştir" : "Dosya Seç"}
              </button>
              <span className="flex-1 truncate text-muted-foreground" title={file?.name}>
                {file?.name ?? "dosya seçilmedi"}
              </span>
              <input
                ref={inputRef}
                type="file"
                accept=".tif,.tiff,.svs,.ndpi"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="flex items-center gap-2 pt-0.5">
              <Button size="sm" onClick={handleUpload} disabled={uploading || !file} className="h-8 gap-1.5">
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {uploading ? "Analiz ediliyor…" : "Analiz Et"}
              </Button>
              {uploading && (
                <span className="text-xs text-muted-foreground">{"Yükleme + CPU çıkarımı birkaç dakika sürebilir…"}</span>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Geçmiş bir analizin özet kartı. */
function HistoryCard({ analysis, onView }: { analysis: PathologyAnalysis; onView: () => void }) {
  const dateStr = new Date(analysis.date).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })
  return (
    <div className="flex gap-2 rounded-md border p-2">
      <div className="relative shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={analysis.thumbnailUrl}
          alt="Slide thumbnail"
          className="h-16 w-16 rounded object-cover bg-black/10"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div>
          <p className="text-xs font-medium truncate" title={analysis.fileName}>{analysis.fileName}</p>
          <p className="text-[11px] text-muted-foreground">{dateStr}</p>
          <p className="text-[11px] text-muted-foreground">
            Maks. olasılık %{Math.round(analysis.metrics.maxProb * 100)} · Tümör alanı %{analysis.metrics.tumorAreaPct}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={onView} className="h-7 w-fit gap-1 text-xs">
          <Eye className="h-3 w-3" />
          İncele
        </Button>
      </div>
    </div>
  )
}

/** Isı haritası + ham thumbnail, opaklık kaydırıcılı görüntüleyici. */
function HeatmapViewer({ analysis }: { analysis: PathologyAnalysis }) {
  const [opacity, setOpacity] = useState(DEFAULT_OPACITY)
  const [fullscreen, setFullscreen] = useState(false)
  const [zoomedIn, setZoomedIn] = useState(false)
  const [origin, setOrigin] = useState({ x: 50, y: 50 })

  function handleZoomClick(e: React.MouseEvent<HTMLDivElement>) {
    if (zoomedIn) {
      setZoomedIn(false)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    setOrigin({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    })
    setZoomedIn(true)
  }

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-md border bg-black group">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={analysis.thumbnailUrl} alt="Ham slide" className="w-full select-none" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={analysis.heatmapUrl}
          alt="Tümör olasılık ısı haritası"
          className="absolute inset-0 w-full select-none pointer-events-none"
          style={{ opacity: opacity / 100 }}
        />
        <button
          onClick={() => setFullscreen(true)}
          title="Tam ekran görüntüle"
          className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-[11px] text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
        >
          <Maximize2 className="h-3 w-3" />
          Büyüt
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpacity((o) => (o > 0 ? 0 : DEFAULT_OPACITY))}
          className="flex w-20 shrink-0 items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          {opacity > 0 ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          Isı haritası
        </button>
        <input
          type="range"
          min={0}
          max={100}
          value={opacity}
          onChange={(e) => setOpacity(Number(e.target.value))}
          className="h-1.5 flex-1 cursor-pointer accent-red-500"
        />
        <span className="w-14 shrink-0 text-right font-mono text-[11px] text-muted-foreground">%{opacity}</span>
      </div>

      <Dialog
        open={fullscreen}
        onOpenChange={(v) => {
          setFullscreen(v)
          if (!v) setZoomedIn(false)
        }}
      >
        <DialogContent className="max-w-[98vw] w-[98vw] h-[96vh] flex flex-col p-3 overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Microscope className="h-4 w-4 text-violet-600" />
              {analysis.fileName}
            </DialogTitle>
          </DialogHeader>
          <div
            className="relative min-h-0 flex-1 overflow-hidden rounded-md border bg-black flex items-center justify-center"
            style={{ cursor: zoomedIn ? "zoom-out" : "zoom-in" }}
            onClick={handleZoomClick}
          >
            <div
              className="relative h-full w-full"
              style={{
                transform: `scale(${zoomedIn ? 2.5 : 1})`,
                transformOrigin: `${origin.x}% ${origin.y}%`,
                transition: "transform 150ms ease-out",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={analysis.thumbnailUrl} alt="Ham slide" className="h-full w-full select-none object-contain" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={analysis.heatmapUrl}
                alt="Tümör olasılık ısı haritası"
                className="absolute inset-0 h-full w-full select-none pointer-events-none object-contain"
                style={{ opacity: opacity / 100 }}
              />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 pt-2">
            <button
              onClick={() => setOpacity((o) => (o > 0 ? 0 : DEFAULT_OPACITY))}
              className="flex w-20 shrink-0 items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              {opacity > 0 ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              Isı haritası
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="h-1.5 flex-1 cursor-pointer accent-red-500"
            />
            <span className="w-14 shrink-0 text-right font-mono text-[11px] text-muted-foreground">%{opacity}</span>
          </div>
        </DialogContent>
      </Dialog>
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

function MetricsCard({ analysis }: { analysis: PathologyAnalysis }) {
  const { metrics } = analysis
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Tespit Metrikleri</p>
      <div className="grid grid-cols-3 gap-2">
        <Metric label="Maks. olasılık" value={`%${Math.round(metrics.maxProb * 100)}`} />
        <Metric label="Tümör alanı" value={`%${metrics.tumorAreaPct}`} />
        <Metric label="Analiz edilen patch" value={`${metrics.patchesAnalyzed}`} />
      </div>
      <div className="flex items-center gap-3 pt-0.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Cpu className="h-3 w-3" />{analysis.device}</span>
        <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{(analysis.elapsedMs / 1000).toFixed(1)} sn</span>
      </div>
      <p className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
        <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
        Deneysel MVP — klinik tanı amaçlı değildir. CPU&apos;da makul sürede bitmesi için sınırlı sayıda
        patch analiz edilmiştir, tam kapsamlı bir tarama değildir.
      </p>
    </div>
  )
}

/** Zaman çizelgesindeki bir patoloji analiz kaydı için "Görüntüle" butonu + modal. */
export function TimelinePathologyViewerButton({ analysis }: { analysis: PathologyAnalysis }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md border bg-background/60 px-2 py-1 text-xs hover:bg-background transition-colors"
      >
        <Microscope className="h-3 w-3 text-violet-600" />
        Görüntüle
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl w-[95vw] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Microscope className="h-4 w-4 text-violet-600" />
              {analysis.fileName}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 lg:grid-cols-2">
            <HeatmapViewer analysis={analysis} />
            <MetricsCard analysis={analysis} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
