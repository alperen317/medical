"use client"

import { useRef, useState } from "react"
import { Brain, Loader2, AlertTriangle, Sparkles, Clock, Cpu, Eye, EyeOff, Upload, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/store/ui.store"
import type { BrainAnalysis, PlaneName } from "@/lib/ai/brain-tumor"

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

export function BrainTumorPanel({
  patientId,
  canRun,
}: {
  patientId: string
  canRun: boolean
}) {
  const [analysis, setAnalysis] = useState<BrainAnalysis | null>(null)
  const [uploadFiles, setUploadFiles] = useState<UploadFiles>(EMPTY_UPLOAD)
  const [uploading, setUploading] = useState(false)

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
      setAnalysis(data.analysis)
      toast.success("Segmentasyon tamamlandı ve zaman çizelgesine eklendi.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Yükleme sırasında hata oluştu.")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="rounded-lg border border-sky-200/70 dark:border-sky-900/50 bg-linear-to-r from-sky-50/60 to-transparent dark:from-sky-950/20">
      {/* Başlık */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 border-b border-sky-100/70 dark:border-sky-900/40">
        <Brain className="h-4 w-4 shrink-0 text-sky-600" />
        <span className="text-sm font-medium">Beyin MR Tümör Analizi</span>
        <Badge variant="secondary" className="text-[10px] font-normal">MVP · Deneysel</Badge>
      </div>

      <div className="px-3 py-3 space-y-3">
        {/* Sorumluluk reddi */}
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>Deneysel araç — MONAI/BraTS örnek modeli. Klinik tanı amaçlı <b>değildir</b>.</span>
        </div>

        <UploadForm
          files={uploadFiles}
          onFile={(key, file) => setUploadFiles((prev) => ({ ...prev, [key]: file }))}
          onSubmit={handleUpload}
          disabled={!canRun}
          uploading={uploading}
        />

        {/* Sonuç */}
        {analysis && (
          <div className="grid gap-4 lg:grid-cols-2 pt-1">
            <BrainViewerPane analysis={analysis} />
            <MetricsCard analysis={analysis} />
          </div>
        )}
      </div>
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
