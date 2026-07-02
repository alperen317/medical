// ICD giriş biçimlendirme yardımcıları — saf fonksiyonlar (hem sunucu hem istemci
// tarafından kullanılabilir; "use client" veya "server-only" bağımlılığı yoktur).

export type IcdEntryLike = { code: string; title: string }

/** Seçilen ICD girişini tag dizisinde saklanacak "KOD — Başlık" formatına çevirir. */
export function formatIcdEntry(entry: IcdEntryLike): string {
  return entry.title ? `${entry.code} — ${entry.title}` : entry.code
}

/** Bir tag string'inden (varsa) ICD kodunu ayıklar: "5A11 — ..." → "5A11". */
export function extractIcdCode(tag: string): string | null {
  const match = tag.match(/^([A-Z0-9]{1,7}(?:\.[A-Z0-9]+)?)\s+—\s/)
  return match ? match[1] : null
}

/** Bir tag string'inden ICD kodunu çıkarıp yalnızca insan-okur başlığı döndürür. */
export function stripIcdCode(tag: string): string {
  return tag.replace(/^[A-Z0-9]{1,7}(?:\.[A-Z0-9]+)?\s+—\s+/, "").trim()
}
