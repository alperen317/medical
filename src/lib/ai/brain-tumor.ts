import "server-only"

// MONAI beyin tümörü segmentasyon mikroservisi (Python/FastAPI) istemcisi.
// Servis ayrı bir konteynerde çalışır; buradan yalnızca HTTP ile konuşuruz.

const BASE_URL = process.env.AI_INFERENCE_URL ?? "http://localhost:8070"

// CPU'da çıkarım dakikalar sürebilir — cömert bir zaman aşımı ver.
const SEGMENT_TIMEOUT_MS = 15 * 60 * 1000

export type BrainMetrics = {
  brainMl: number
  wtPctOfBrain: number
  maxDiameterMm: number
}

export type PlaneName = "axial" | "coronal" | "sagittal"

/** Tek kesit: base (gri) ve maske (saydam RGBA) PNG'leri (base64, data URI değil). */
export type ViewerSlice = { index: number; basePng: string; maskPng: string }

export type ViewerPlane = {
  axis: string
  defaultIndex: number
  slices: ViewerSlice[]
}

export type BrainViewer = {
  planes: Record<PlaneName, ViewerPlane>
}

export type BrainSegmentationResult = {
  caseId: string | null
  volumes: { tc: number; wt: number; et: number }
  /** base64 PNG (data URI değil — çağıran taraf `data:image/png;base64,` ekler) */
  overlayPng: string
  metrics: BrainMetrics
  viewer: BrainViewer
  elapsedMs: number
  device: string
}

/** Geçmiş analiz özeti — hasta detayında liste için (ağır viewer verisi olmadan). */
export type BrainAnalysisSummary = {
  id: string
  date: string
  volumes: { tc: number; wt: number; et: number }
  /** Eski kayıtlarda bulunmayabilir (metrics sonradan eklendi). */
  metrics: BrainMetrics | null
  source: string
  overlayUrl: string | null
  /** Tam görüntüleyici JSON dosyası; null ise (eski kayıt) yalnızca özet gösterilir. */
  analysisFile: string | null
}

/** Panele/istemciye dönen, kalıcılaştırılmış analiz sonucu (viewer PNG'leri data URI). */
export type BrainAnalysis = {
  caseId: string
  volumes: { tc: number; wt: number; et: number }
  overlayUrl: string
  metrics: BrainMetrics
  viewer: BrainViewer
  device: string
  elapsedMs: number
}

/** Viewer PNG'lerini panelde doğrudan gösterebilmek için data URI'ye çevirir. */
export function toDataUriViewer(viewer: BrainViewer): BrainViewer {
  const png = (b64: string) => `data:image/png;base64,${b64}`
  const planes = {} as BrainViewer["planes"]
  for (const key of Object.keys(viewer.planes) as PlaneName[]) {
    const plane = viewer.planes[key]
    planes[key] = {
      ...plane,
      slices: plane.slices.map((s) => ({
        index: s.index,
        basePng: png(s.basePng),
        maskPng: png(s.maskPng),
      })),
    }
  }
  return { planes }
}

/** Inference servisi yapılandırılmış mı? (bynara.ts desenine paralel) */
export function isBrainInferenceConfigured(): boolean {
  return Boolean(process.env.AI_INFERENCE_URL)
}

async function getJson<T>(path: string, init?: RequestInit, timeoutMs = 15_000): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  })
  if (!res.ok) {
    let detail = `${res.status}`
    try {
      const body = (await res.json()) as { detail?: string }
      if (body?.detail) detail = body.detail
    } catch {
      /* ignore parse error */
    }
    throw new Error(`inference: ${detail}`)
  }
  return res.json() as Promise<T>
}

/**
 * Kullanıcının yüklediği 4 modalite NIfTI üzerinde segmentasyon çalıştırır.
 * `Content-Type` elle set edilmez; fetch multipart boundary'yi kendi ekler.
 */
export async function runBrainSegmentationUpload(files: {
  flair: File
  t1: File
  t1c: File
  t2: File
}): Promise<BrainSegmentationResult> {
  const fd = new FormData()
  fd.append("flair", files.flair, files.flair.name)
  fd.append("t1", files.t1, files.t1.name)
  fd.append("t1c", files.t1c, files.t1c.name)
  fd.append("t2", files.t2, files.t2.name)
  return getJson<BrainSegmentationResult>(
    "/segment-upload",
    { method: "POST", body: fd },
    SEGMENT_TIMEOUT_MS,
  )
}
