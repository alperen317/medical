import "server-only"

// MONAI patoloji tümör tespiti mikroservisi (Python/FastAPI) istemcisi.
// Servis ayrı bir konteynerde çalışır; buradan yalnızca HTTP ile konuşuruz.
// brain-tumor.ts ile aynı desen — WSI'lar büyük olduğundan tek dosya yüklenir
// ve çok-düzlemli interaktif görüntüleyici yerine tek bir ısı haritası döner.

const BASE_URL = process.env.PATHOLOGY_INFERENCE_URL ?? "http://localhost:8071"

// WSI dosyaları GB mertebesinde olabilir; CPU'da tarama dakikalar sürebilir —
// cömert bir zaman aşımı ver.
const DETECT_TIMEOUT_MS = 20 * 60 * 1000

export type PathologyMetrics = {
  maxProb: number
  tumorAreaPct: number
  patchesAnalyzed: number
}

export type PathologyDetectionResult = {
  fileName: string
  /** base64 PNG (data URI değil — çağıran taraf `data:image/png;base64,` ekler) */
  heatmapPng: string
  thumbnailPng: string
  metrics: PathologyMetrics
  elapsedMs: number
  device: string
}

/**
 * Panele/istemciye dönen, kalıcılaştırılmış analiz sonucu. Hem yeni yüklenen
 * analizin canlı görünümü hem de geçmiş analizler listesi için kullanılır
 * (ısı haritası + thumbnail birer statik PNG olduğundan brain-tumor'daki
 * ayrı "summary vs. tam görüntüleyici" ayrımına burada gerek yok).
 */
export type PathologyAnalysis = {
  id: string
  date: string
  fileName: string
  heatmapUrl: string
  thumbnailUrl: string
  metrics: PathologyMetrics
  device: string
  elapsedMs: number
}

/** Inference servisi yapılandırılmış mı? (brain-tumor.ts desenine paralel) */
export function isPathologyInferenceConfigured(): boolean {
  return Boolean(process.env.PATHOLOGY_INFERENCE_URL)
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
 * Kullanıcının yüklediği tek bir WSI (.tif/.tiff/.svs/.ndpi) üzerinde tümör
 * tespiti çalıştırır. `Content-Type` elle set edilmez; fetch multipart
 * boundary'yi kendi ekler.
 */
export async function runPathologyDetectionUpload(file: File): Promise<PathologyDetectionResult> {
  const fd = new FormData()
  fd.append("file", file, file.name)
  return getJson<PathologyDetectionResult>(
    "/detect-upload",
    { method: "POST", body: fd },
    DETECT_TIMEOUT_MS,
  )
}
