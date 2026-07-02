import "server-only"
import {
  type LabValue,
  type PatientContext,
  normalizeTestName,
  extractAbnormal,
  rankByClinicalImportance,
  formatLabLine,
  buildSystemPrompt,
} from "./lab-report"
import { callBynara, isBynaraConfigured } from "./bynara"
import { searchIcd, isIcdConfigured, type IcdEntry } from "@/lib/icd/client"
import { extractIcdCode, stripIcdCode } from "@/lib/icd/format"

// ── Types ────────────────────────────────────────────────────────────────────

export interface LabSnapshot {
  date: Date
  documentType: string
  values: LabValue[]
}

export interface PatientClinicalContext {
  age?: number
  sex?: "M" | "F"
  chronicConditions: string[]
  allergies: string[]
  activeMedications: string[]
  labHistory: LabSnapshot[]
}

export type TrendDirection = "rising" | "falling" | "stable"

export interface TrendFinding {
  name: string
  unit: string
  direction: TrendDirection
  latestStatus: LabValue["status"]
  series: { date: string; value: number }[]
}

export interface InteractionFinding {
  medication: string
  conflictsWith: string
  kind: "allergy"
  severity: "warning"
}

export interface PatientSummaryResult {
  summary: string
  systemPrompt: string
  prompt: string
  trends: TrendFinding[]
  interactions: InteractionFinding[]
  suggestedIcd: IcdEntry[]
  model: string
  generatedAt: string
}

// ── Trend detection (deterministic, LLM'siz) ─────────────────────────────────

function toNumber(v: string): number {
  return parseFloat(v.replace(",", "."))
}

/**
 * Tüm lab dokümanlarındaki değerleri test adına göre gruplar, zamana göre sıralar
 * ve her test için yön (artan/azalan/sabit) + son durumu hesaplar. Yalnızca en az
 * 2 ölçümü olan testler döndürülür; anormal olanlar öne alınır.
 */
export function detectTrends(labHistory: LabSnapshot[]): TrendFinding[] {
  const series = new Map<string, { name: string; unit: string; points: { date: Date; value: number; status: LabValue["status"] }[] }>()

  for (const snap of labHistory) {
    for (const v of snap.values) {
      const num = toNumber(v.value)
      if (isNaN(num)) continue
      const key = normalizeTestName(v.name)
      if (!key) continue
      const entry = series.get(key) ?? { name: v.name, unit: v.unit, points: [] }
      entry.points.push({ date: snap.date, value: num, status: v.status })
      // En güncel görünen ad/birimi tut
      entry.name = v.name
      if (v.unit) entry.unit = v.unit
      series.set(key, entry)
    }
  }

  const findings: TrendFinding[] = []
  for (const { name, unit, points } of series.values()) {
    if (points.length < 2) continue
    points.sort((a, b) => a.date.getTime() - b.date.getTime())
    const first = points[0].value
    const last = points[points.length - 1].value
    let direction: TrendDirection = "stable"
    if (last > first * 1.1) direction = "rising"
    else if (last < first * 0.9) direction = "falling"

    findings.push({
      name,
      unit,
      direction,
      latestStatus: points[points.length - 1].status,
      series: points.map((p) => ({ date: p.date.toISOString(), value: p.value })),
    })
  }

  // Anormal son durumu ve hareketli olanları öne al
  const statusRank: Record<LabValue["status"], number> = { critical: 0, high: 1, low: 2, normal: 3 }
  return findings.sort((a, b) => {
    const s = statusRank[a.latestStatus] - statusRank[b.latestStatus]
    if (s !== 0) return s
    const am = a.direction === "stable" ? 1 : 0
    const bm = b.direction === "stable" ? 1 : 0
    return am - bm
  })
}

// ── Allergy ↔ medication overlap (deterministic) ─────────────────────────────

function tokenize(text: string): string[] {
  return normalizeTestName(text).split(" ").filter((t) => t.length >= 4)
}

/**
 * Aktif ilaçlar ile alerjiler arasında ad/token örtüşmesini yüksek kesinlikle
 * tespit eder (ör. alerji "Aspirin" + ilaç "Aspirin 100mg"). İlaç-sınıfı düzeyi
 * çıkarımlar LLM'e bırakılır.
 */
export function checkInteractions(
  activeMedications: string[],
  allergies: string[],
): InteractionFinding[] {
  const findings: InteractionFinding[] = []
  const allergyTerms = allergies.map((a) => ({ raw: a, human: stripIcdCode(a), tokens: tokenize(a) }))

  for (const med of activeMedications) {
    const medNorm = normalizeTestName(med)
    for (const allergy of allergyTerms) {
      if (allergy.tokens.length === 0) continue
      const hit = allergy.tokens.some((tok) => medNorm.includes(tok))
      if (hit) {
        findings.push({ medication: med, conflictsWith: allergy.human, kind: "allergy", severity: "warning" })
        break
      }
    }
  }
  return findings
}

// ── ICD suggestion ───────────────────────────────────────────────────────────

/**
 * Kodsuz kronik hastalıklar + LLM'in önerdiği ek tanı adları için ICD-11 karşılığı
 * arar. searchIcd yapılandırılmamışsa boş döner.
 */
async function suggestIcd(chronicConditions: string[], extraNames: string[]): Promise<IcdEntry[]> {
  if (!isIcdConfigured()) return []

  // Zaten kodu olan kronik hastalıkları atla
  const codelessConditions = chronicConditions
    .filter((c) => !extractIcdCode(c))
    .map(stripIcdCode)
  const queries = [...new Set([...codelessConditions, ...extraNames].map((s) => s.trim()).filter((s) => s.length >= 3))]

  const suggestions: IcdEntry[] = []
  const seenCodes = new Set<string>()
  for (const q of queries.slice(0, 8)) {
    try {
      const results = await searchIcd(q, 1)
      const top = results[0]
      if (top && !seenCodes.has(top.code)) {
        seenCodes.add(top.code)
        suggestions.push(top)
      }
    } catch {
      // tek bir sorgunun hatası tüm süreci bozmamalı
    }
    if (suggestions.length >= 6) break
  }
  return suggestions
}

/** LLM çıktısındaki "ICD_ONERI: a, b, c" satırından tanı adlarını ayıklar. */
function parseSuggestedNames(summary: string): { cleaned: string; names: string[] } {
  const match = summary.match(/ICD_ONERI\s*:\s*(.+)$/im)
  if (!match) return { cleaned: summary.trim(), names: [] }
  const names = match[1].split(/[,;]/).map((s) => s.trim()).filter(Boolean)
  const cleaned = summary.replace(match[0], "").trim()
  return { cleaned, names }
}

// ── Prompt building ──────────────────────────────────────────────────────────

function latestValuePerTest(labHistory: LabSnapshot[]): LabValue[] {
  const byTest = new Map<string, { date: Date; value: LabValue }>()
  for (const snap of labHistory) {
    for (const v of snap.values) {
      const key = normalizeTestName(v.name)
      if (!key) continue
      const existing = byTest.get(key)
      if (!existing || snap.date.getTime() > existing.date.getTime()) {
        byTest.set(key, { date: snap.date, value: v })
      }
    }
  }
  return [...byTest.values()].map((e) => e.value)
}

function buildPatientSystemPrompt(): string {
  return `${buildSystemPrompt()} Bu, tek bir tahlil değil, hastanın GENEL klinik tablosudur: kronik hastalıklar, ilaçlar, laboratuvar geçmişi ve trendleri birlikte değerlendir. Yanıtını ## başlıklı bölümler halinde ver (ör. "## Genel Değerlendirme", "## Öne Çıkan Bulgular", "## Öneriler"). Yeni/kodlanabilir bir tanı tespit edersen, en sona AYRI bir satır olarak "ICD_ONERI: tanı1, tanı2" ekle (yoksa ekleme).`
}

// LLM'e gönderilen görev talimatı (prompt iskeleti). Kullanıcı önizlemesinde
// GÖSTERİLMEZ — yalnızca hasta verisi onaya sunulur, talimat üretim anında eklenir.
const SUMMARY_INSTRUCTION =
  "Bu verileri BİRLİKTE değerlendirerek hastanın genel klinik durumunu, bulgular arası ilişkileri, riskleri ve önerileri Türkçe özetle. İlaç–alerji çakışması varsa ilaç sınıfı düzeyinde de kontrol et."

// Yalnızca hasta VERİSİNİ (talimatsız) blok olarak kurar. Önizleme/onay adımında
// kullanıcıya gösterilen ve düzenlenebilen kısım budur.
function buildPatientDataBlock(
  ctx: PatientClinicalContext,
  ranked: ReturnType<typeof rankByClinicalImportance>,
  trends: TrendFinding[],
  interactions: InteractionFinding[],
): string {
  const lines: string[] = []

  // Gizlilik: LLM'e yalnızca klinik olarak gerekli demografik veri (yaş + cinsiyet)
  // gönderilir. Ad/TC/telefon/e-posta/adres gibi kimlik bilgileri prompt'a EKLENMEZ.
  const demo: string[] = []
  if (ctx.age) demo.push(`Yaş: ${ctx.age}`)
  if (ctx.sex) demo.push(`Cinsiyet: ${ctx.sex === "M" ? "Erkek" : "Kadın"}`)
  if (demo.length) lines.push(`Hasta: ${demo.join(", ")}`)

  if (ctx.chronicConditions.length)
    lines.push(`Kronik hastalıklar: ${ctx.chronicConditions.map(stripIcdCode).join(", ")}`)
  if (ctx.allergies.length)
    lines.push(`Alerjiler: ${ctx.allergies.map(stripIcdCode).join(", ")}`)
  if (ctx.activeMedications.length)
    lines.push(`Aktif ilaçlar: ${ctx.activeMedications.join("; ")}`)

  if (ranked.length) {
    lines.push("", "En güncel anormal laboratuvar değerleri:")
    lines.push(ranked.map(formatLabLine).join("\n"))
  }

  const dirLabel: Record<TrendDirection, string> = { rising: "artıyor", falling: "azalıyor", stable: "sabit" }
  const movingTrends = trends.filter((t) => t.direction !== "stable")
  if (movingTrends.length) {
    lines.push("", "Zaman içindeki trendler:")
    lines.push(movingTrends.map((t) => {
      const vals = t.series.map((s) => s.value).join(" → ")
      return `- ${t.name}: ${vals} ${t.unit} (${dirLabel[t.direction]})`
    }).join("\n"))
  }

  if (interactions.length) {
    lines.push("", "Olası ilaç–alerji çakışmaları (doğrulanmalı):")
    lines.push(interactions.map((i) => `- ${i.medication} ↔ alerji: ${i.conflictsWith}`).join("\n"))
  }

  return lines.join("\n")
}

/** Onaylanan veri bloğuna gizli görev talimatını ekleyerek nihai LLM istemini kurar. */
function composeUserPrompt(dataBlock: string): string {
  return `${dataBlock.trim()}\n\n${SUMMARY_INSTRUCTION}`
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * LLM'e GÖNDERİLECEK veriyi (kullanıcı istemi) ve deterministik bulguları,
 * LLM'i çağırmadan hazırlar. Kullanıcı önizleme/onay adımında bu payload'ı görür
 * ve gerekirse düzenler/redakte eder. Gönderilen metinde kimlik bilgisi bulunmaz.
 */
export function prepareSummaryInput(ctx: PatientClinicalContext): {
  payload: string
  trends: TrendFinding[]
  interactions: InteractionFinding[]
} {
  const trends = detectTrends(ctx.labHistory)
  const interactions = checkInteractions(ctx.activeMedications, ctx.allergies)

  const patientCtx: PatientContext = { age: ctx.age, sex: ctx.sex }
  const latest = latestValuePerTest(ctx.labHistory)
  const abnormal = extractAbnormal(latest)
  const ranked = rankByClinicalImportance(abnormal, patientCtx)

  return {
    payload: buildPatientDataBlock(ctx, ranked, trends, interactions),
    trends,
    interactions,
  }
}

/**
 * Hasta düzeyinde bütüncül klinik değerlendirme üretir. Trend ve çakışma analizi
 * deterministiktir (LLM'siz de çalışır); LLM yalnızca özet metni için kullanılır.
 * Bynara yapılandırılmamışsa summary boş döner, trend/çakışma yine döndürülür.
 *
 * `payloadOverride` verilirse (kullanıcının önizlemede onayladığı/düzenlediği metin),
 * LLM'e bu metin gönderilir; trend/çakışma yine gerçek veriden deterministik hesaplanır.
 */
export async function generatePatientSummary(
  ctx: PatientClinicalContext,
  opts: { payloadOverride?: string } = {},
): Promise<PatientSummaryResult> {
  const trends = detectTrends(ctx.labHistory)
  const interactions = checkInteractions(ctx.activeMedications, ctx.allergies)

  const patientCtx: PatientContext = { age: ctx.age, sex: ctx.sex }
  const latest = latestValuePerTest(ctx.labHistory)
  const abnormal = extractAbnormal(latest)
  const ranked = rankByClinicalImportance(abnormal, patientCtx)

  // Kullanıcı onayladığı veri bloğu (varsa) ya da yeniden kurulan veri bloğu +
  // gizli görev talimatı = nihai LLM istemi.
  const dataBlock = opts.payloadOverride?.trim() || buildPatientDataBlock(ctx, ranked, trends, interactions)
  const userContent = composeUserPrompt(dataBlock)
  const systemPrompt = buildPatientSystemPrompt()

  let summary = ""
  let suggestedNames: string[] = []
  if (isBynaraConfigured()) {
    const raw = await callBynara(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      { maxTokens: 1500, temperature: 0.2 },
    )
    const parsed = parseSuggestedNames(raw)
    summary = parsed.cleaned
    suggestedNames = parsed.names
  }

  const suggestedIcd = await suggestIcd(ctx.chronicConditions, suggestedNames)

  return {
    summary,
    systemPrompt,
    prompt: userContent,
    trends,
    interactions,
    suggestedIcd,
    model: process.env.BYNARA_MODEL ?? "auto/bynara",
    generatedAt: new Date().toISOString(),
  }
}
