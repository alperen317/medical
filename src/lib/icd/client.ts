import "server-only"

/**
 * WHO ICD-11 API istemcisi (sunucu tarafı).
 *
 * Kimlik bilgileri icd.who.int/icdapi üzerinden ücretsiz alınır ve
 * .env.local'e eklenir:
 *   ICD_CLIENT_ID="..."
 *   ICD_CLIENT_SECRET="..."
 * İsteğe bağlı override'lar:
 *   ICD_TOKEN_ENDPOINT (varsayılan: WHO OAuth2 token uç noktası)
 *   ICD_API_BASE       (varsayılan: https://id.who.int)
 *   ICD_RELEASE        (varsayılan: 2024-01 — MMS linearizasyon sürümü)
 *   ICD_LANGUAGE       (varsayılan: tr)
 *
 * ClientSecret istemciye asla sızmaz — bu modül yalnızca sunucuda çalışır ve
 * /api/icd/search proxy route'u üzerinden erişilir.
 */

const TOKEN_ENDPOINT =
  process.env.ICD_TOKEN_ENDPOINT ?? "https://icdaccessmanagement.who.int/connect/token"
const API_BASE = (process.env.ICD_API_BASE ?? "https://id.who.int").replace(/\/$/, "")
const RELEASE = process.env.ICD_RELEASE ?? "2024-01"
const LANGUAGE = process.env.ICD_LANGUAGE ?? "tr"

export type IcdEntry = { code: string; title: string }

/** ICD entegrasyonu için gerekli kimlik bilgileri tanımlı mı? */
export function isIcdConfigured(): boolean {
  return Boolean(process.env.ICD_CLIENT_ID && process.env.ICD_CLIENT_SECRET)
}

// Access token'ı modül düzeyinde cache'le — WHO token'ları ~1 saat geçerlidir.
let tokenCache: { token: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  const now = Date.now()
  if (tokenCache && tokenCache.expiresAt > now) return tokenCache.token

  const body = new URLSearchParams({
    client_id: process.env.ICD_CLIENT_ID!,
    client_secret: process.env.ICD_CLIENT_SECRET!,
    scope: "icdapi_access",
    grant_type: "client_credentials",
  })

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    // Token yanıtı cache'lenmemeli
    cache: "no-store",
  })

  if (!res.ok) {
    throw new Error(`ICD token isteği başarısız (${res.status})`)
  }

  const json = (await res.json()) as { access_token: string; expires_in?: number }
  const ttlMs = (json.expires_in ?? 3600) * 1000
  // 60 sn güvenlik payı bırak
  tokenCache = { token: json.access_token, expiresAt: now + ttlMs - 60_000 }
  return json.access_token
}

/** WHO arama sonuçlarındaki <em class='found'>...</em> vurgu etiketlerini temizle. */
function stripHtml(input: string): string {
  return input
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim()
}

type MmsSearchResponse = {
  destinationEntities?: Array<{
    id?: string
    title?: string
    theCode?: string
  }>
}

/**
 * ICD-11 MMS linearizasyonunda arama yapar. Kodu olan (theCode dolu) girişleri
 * döndürür. Alerji ve kronik hastalık için aynı arama kullanılır.
 */
export async function searchIcd(query: string, limit = 15): Promise<IcdEntry[]> {
  const q = query.trim()
  if (q.length < 2) return []

  const token = await getAccessToken()
  const url = new URL(`${API_BASE}/icd/release/11/${RELEASE}/mms/search`)
  url.searchParams.set("q", q)
  url.searchParams.set("flatResults", "true")
  url.searchParams.set("useFlexisearch", "false")

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Accept-Language": LANGUAGE,
      "API-Version": "v2",
    },
    cache: "no-store",
  })

  if (!res.ok) {
    throw new Error(`ICD arama isteği başarısız (${res.status})`)
  }

  const json = (await res.json()) as MmsSearchResponse
  const entities = json.destinationEntities ?? []
  const seen = new Set<string>()
  const results: IcdEntry[] = []

  for (const e of entities) {
    const code = (e.theCode ?? "").trim()
    // Kodu olmayan (kategori başlığı vb.) girişleri atla
    if (!code) continue
    if (seen.has(code)) continue
    seen.add(code)
    results.push({ code, title: stripHtml(e.title ?? "") })
    if (results.length >= limit) break
  }

  return results
}
