import "server-only"
import { callBynara, type ChatMessage } from "./bynara"

// ── Types ────────────────────────────────────────────────────────────────────

export interface LabValue {
  name: string
  value: string
  unit: string
  refRange: string
  status: "normal" | "high" | "low" | "critical"
}

export interface PatientContext {
  age?: number
  sex?: "M" | "F"
  symptoms?: string[]
}

export interface LabReportResult {
  extractedValues: LabValue[]
  aiReport: string
}

export type ClinicalSystem =
  | "Hematoloji"
  | "Metabolik"
  | "Böbrek"
  | "Karaciğer"
  | "Enfeksiyon/İnflamasyon"
  | "Tiroid"
  | "Elektrolit"
  | "Demir Metabolizması"
  | "Diğer"

export interface ParsedRefRange {
  low: number | null
  high: number | null
  mode: "range" | "lt" | "gt" | "unknown"
}

export interface RankedLabValue extends LabValue {
  system: ClinicalSystem
  importanceScore: number
  riskNotes: string[]
}

interface StratifiedFindings {
  primary: RankedLabValue[]
  secondary: RankedLabValue[]
}

// ── Classification & parsing ─────────────────────────────────────────────────

function classify(numValue: number, refLow: number, refHigh: number): LabValue["status"] {
  if (isNaN(numValue) || isNaN(refLow) || isNaN(refHigh) || refHigh <= 0) return "normal"
  if (numValue > refHigh * 1.5) return "critical"
  if (numValue > refHigh)       return "high"
  if (numValue < refLow)        return "low"
  return "normal"
}

function parseLabValuesFromText(text: string): LabValue[] {
  const values: LabValue[] = []
  const seen   = new Set<string>()

  // ── Format 1: refLow - refHigh value unit [(D/Y)] name ──────────────────
  const fmt1 =
    /([\d]+(?:[,.][\d]+)?)\s*-\s*([\d]+(?:[,.][\d]+)?)\s+([\d]+(?:[,.][\d]+)?)\s+([A-Za-z%^\/µ\d.]{1,15})\s+(?:\([DYK]\)\s+)?([A-ZÇĞİÖŞÜa-zçğışöüü][A-ZÇĞİÖŞÜa-zçğışöüü\s%#()\/.-]{0,40}?)(?=\s+[\d]+(?:[,.][\d]+)?\s*-|$)/g

  for (const m of text.matchAll(fmt1)) {
    const name = m[5].trim().replace(/\s+/g, " ")
    if (!name || seen.has(name)) continue
    seen.add(name)
    const value = m[3].replace(",", ".")
    const rl = parseFloat(m[1].replace(",", "."))
    const rh = parseFloat(m[2].replace(",", "."))
    values.push({ name, value, unit: m[4], refRange: `${m[1]}-${m[2]}`, status: classify(parseFloat(value), rl, rh) })
  }

  // ── Format 2: name value refLow - refHigh ────────────────────────────────
  const joined = text.replace(
    /\n([\d]+(?:[.,][\d]+)?\s*-\s*[\d]+(?:[.,][\d]+)?)\s*(?=\n)/g,
    " $1\n"
  )

  const fmt2 =
    /^([A-ZÇĞİÖŞÜ][A-Za-zÇĞİÖŞÜçğışöüü\s%#()-]{0,35}?)\s+([\d]+(?:[,.][\d]+)?)\s+([\d]+(?:[,.][\d]+)?)\s*-\s*([\d]+(?:[,.][\d]+)?)\s*$/gm

  for (const m of joined.matchAll(fmt2)) {
    const name = m[1].trim().replace(/\s+/g, " ")
    if (!name || seen.has(name)) continue
    seen.add(name)
    const value = m[2].replace(",", ".")
    const rl = parseFloat(m[3].replace(",", "."))
    const rh = parseFloat(m[4].replace(",", "."))
    values.push({ name, value, unit: "", refRange: `${m[3]}-${m[4]}`, status: classify(parseFloat(value), rl, rh) })
  }

  return values
}

// ── RefRange parsing ─────────────────────────────────────────────────────────

// Handles: "80 - 94", "80–94", "< 94", "> 10", "10 - 20 mg/dL"
export function parseRefRange(refRange: string): ParsedRefRange {
  const norm = refRange
    .trim()
    .replace(/[–—]/g, "-")
    .replace(/,/g, ".")
    .replace(/\s+[A-Za-zµ%^/].+$/, "") // strip trailing unit
    .trim()

  const ltMatch = norm.match(/^<\s*([\d.]+)/)
  if (ltMatch) return { low: null, high: parseFloat(ltMatch[1]), mode: "lt" }

  const gtMatch = norm.match(/^>\s*([\d.]+)/)
  if (gtMatch) return { low: parseFloat(gtMatch[1]), high: null, mode: "gt" }

  const rangeMatch = norm.match(/([\d.]+)\s*-\s*([\d.]+)/)
  if (rangeMatch) return { low: parseFloat(rangeMatch[1]), high: parseFloat(rangeMatch[2]), mode: "range" }

  return { low: null, high: null, mode: "unknown" }
}

// ── System detection ─────────────────────────────────────────────────────────

// Strips Turkish diacritics and normalizes for OCR-tolerant comparison
export function normalizeTestName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[üÜ]/g, "u")
    .replace(/[öÖ]/g, "o")
    .replace(/[çÇ]/g, "c")
    .replace(/[ğĞ]/g, "g")
    .replace(/[şŞ]/g, "s")
    .replace(/[ıİ]/g, "i")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

// Raw aliases (TR + EN + abbreviations); keys will be normalized at build time
const RAW_ALIAS_LIST: [string, ClinicalSystem][] = [
  // Hematoloji
  ["eritrosit", "Hematoloji"], ["rbc", "Hematoloji"],
  ["hemoglobin", "Hematoloji"], ["hgb", "Hematoloji"], ["hb", "Hematoloji"],
  ["hematokrit", "Hematoloji"], ["hct", "Hematoloji"], ["ht", "Hematoloji"],
  ["mcv", "Hematoloji"], ["mch", "Hematoloji"], ["mchc", "Hematoloji"],
  ["rdw", "Hematoloji"], ["rdw-sd", "Hematoloji"], ["rdw-cv", "Hematoloji"],
  ["lokosit", "Hematoloji"], ["lökosit", "Hematoloji"], ["wbc", "Hematoloji"],
  ["notrofil", "Hematoloji"], ["nötrofil", "Hematoloji"],
  ["neu", "Hematoloji"], ["neut", "Hematoloji"],
  ["lenfosit", "Hematoloji"], ["lym", "Hematoloji"], ["lymph", "Hematoloji"],
  ["monosit", "Hematoloji"], ["mon", "Hematoloji"], ["mono", "Hematoloji"],
  ["eozinofil", "Hematoloji"], ["eos", "Hematoloji"],
  ["bazofil", "Hematoloji"], ["bas", "Hematoloji"],
  ["trombosit", "Hematoloji"], ["plt", "Hematoloji"],
  ["mpv", "Hematoloji"], ["pdw", "Hematoloji"],
  ["retikulosit", "Hematoloji"], ["retikülosit", "Hematoloji"],
  // Metabolik
  ["glukoz", "Metabolik"], ["glu", "Metabolik"], ["glucose", "Metabolik"],
  ["aclik sekeri", "Metabolik"], ["tokluk sekeri", "Metabolik"],
  ["hba1c", "Metabolik"], ["a1c", "Metabolik"],
  ["insulin", "Metabolik"], ["insülin", "Metabolik"],
  ["kolesterol", "Metabolik"], ["total kolesterol", "Metabolik"],
  ["ldl", "Metabolik"], ["hdl", "Metabolik"], ["vldl", "Metabolik"],
  ["trigliserid", "Metabolik"], ["triglyceride", "Metabolik"], ["tg", "Metabolik"],
  // Böbrek
  ["kreatinin", "Böbrek"], ["creatinine", "Böbrek"], ["cre", "Böbrek"],
  ["bun", "Böbrek"],
  ["ure", "Böbrek"], ["üre", "Böbrek"], ["urea", "Böbrek"],
  ["gfr", "Böbrek"], ["egfr", "Böbrek"],
  ["urik asit", "Böbrek"], ["ürik asit", "Böbrek"], ["uric acid", "Böbrek"],
  ["sistatin", "Böbrek"], ["cystatin", "Böbrek"],
  // Karaciğer
  ["alt", "Karaciğer"], ["sgpt", "Karaciğer"],
  ["ast", "Karaciğer"], ["sgot", "Karaciğer"],
  ["ggt", "Karaciğer"], ["ggtp", "Karaciğer"],
  ["alp", "Karaciğer"], ["alkalen fosfataz", "Karaciğer"],
  ["bilirubin", "Karaciğer"], ["total bilirubin", "Karaciğer"], ["direkt bilirubin", "Karaciğer"],
  ["albumin", "Karaciğer"], ["total protein", "Karaciğer"], ["ldh", "Karaciğer"],
  // Enfeksiyon/İnflamasyon — "pct" burada prokalsitonin anlamına gelir
  ["crp", "Enfeksiyon/İnflamasyon"], ["c reaktif", "Enfeksiyon/İnflamasyon"],
  ["sedimantasyon", "Enfeksiyon/İnflamasyon"], ["esr", "Enfeksiyon/İnflamasyon"],
  ["prokalsitonin", "Enfeksiyon/İnflamasyon"], ["pct", "Enfeksiyon/İnflamasyon"],
  ["fibrinojen", "Enfeksiyon/İnflamasyon"],
  ["d dimer", "Enfeksiyon/İnflamasyon"], ["ddimer", "Enfeksiyon/İnflamasyon"],
  // Tiroid
  ["tsh", "Tiroid"],
  ["t3", "Tiroid"], ["t4", "Tiroid"],
  ["ft3", "Tiroid"], ["ft4", "Tiroid"], ["st3", "Tiroid"], ["st4", "Tiroid"],
  ["serbest t3", "Tiroid"], ["serbest t4", "Tiroid"],
  // Elektrolit
  ["sodyum", "Elektrolit"], ["sodium", "Elektrolit"], ["na", "Elektrolit"],
  ["potasyum", "Elektrolit"], ["potassium", "Elektrolit"],
  ["klorur", "Elektrolit"], ["klorür", "Elektrolit"], ["chloride", "Elektrolit"], ["cl", "Elektrolit"],
  ["kalsiyum", "Elektrolit"], ["calcium", "Elektrolit"], ["ca", "Elektrolit"],
  ["magnezyum", "Elektrolit"], ["magnesium", "Elektrolit"], ["mg", "Elektrolit"],
  ["fosfor", "Elektrolit"], ["phosphorus", "Elektrolit"],
  ["bikarbonat", "Elektrolit"], ["bicarbonate", "Elektrolit"], ["hco3", "Elektrolit"],
  // Demir Metabolizması
  ["demir", "Demir Metabolizması"], ["iron", "Demir Metabolizması"],
  ["ferritin", "Demir Metabolizması"],
  ["tdbk", "Demir Metabolizması"], ["tibc", "Demir Metabolizması"],
  ["transferrin", "Demir Metabolizması"], ["serum demir", "Demir Metabolizması"],
]

// Pre-normalized alias map (built once at module load)
const SYSTEM_ALIAS_MAP: ReadonlyMap<string, ClinicalSystem> = new Map(
  RAW_ALIAS_LIST.map(([alias, system]) => [normalizeTestName(alias), system])
)

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
  return dp[m][n]
}

export function detectSystem(name: string): ClinicalSystem {
  const normalized = normalizeTestName(name)

  // 1. Exact lookup
  const exact = SYSTEM_ALIAS_MAP.get(normalized)
  if (exact) return exact

  // 2. Substring: alias inside name, or name inside alias
  for (const [alias, system] of SYSTEM_ALIAS_MAP) {
    if (normalized.includes(alias) || alias.includes(normalized)) return system
  }

  // 3. Fuzzy (Levenshtein) — only for short tokens to keep false-positive rate low
  if (normalized.length <= 12) {
    let best: ClinicalSystem = "Diğer"
    let bestDist = Infinity
    for (const [alias, system] of SYSTEM_ALIAS_MAP) {
      if (Math.abs(alias.length - normalized.length) > 3) continue
      const dist = levenshtein(normalized, alias)
      const threshold = Math.max(1, Math.floor(normalized.length * 0.25))
      if (dist < bestDist && dist <= threshold) {
        bestDist = dist
        best = system
      }
    }
    return best
  }

  return "Diğer"
}

// ── Domain heuristics ────────────────────────────────────────────────────────

interface DomainHeuristic {
  matches: (normalized: string) => boolean
  condition: (v: LabValue) => boolean
  urgencyBonus: number
  riskLabel: string
  contextCondition?: (ctx: PatientContext) => boolean
}

const DOMAIN_HEURISTICS: DomainHeuristic[] = [
  {
    matches: (n) => ["notrofil", "neu", "neut"].some((k) => n === k || n.includes(k)),
    condition: (v) => v.status === "low" || v.status === "critical",
    urgencyBonus: 2,
    riskLabel: "nötropeni → enfeksiyon direncinde azalma",
  },
  {
    matches: (n) => n === "hgb" || n === "hb" || n.includes("hemoglobin"),
    condition: (v) => v.status === "low" || v.status === "critical",
    urgencyBonus: 2,
    riskLabel: "anemi",
  },
  {
    matches: (n) => n === "plt" || n.includes("trombosit"),
    condition: (v) => v.status === "low" || v.status === "critical",
    urgencyBonus: 2,
    riskLabel: "trombositopeni → kanama riski",
  },
  {
    matches: (n) => n === "cre" || n.includes("kreatinin") || n.includes("creatinine"),
    condition: (v) => v.status === "high" || v.status === "critical",
    urgencyBonus: 2,
    riskLabel: "böbrek fonksiyon bozukluğu",
    contextCondition: (ctx) => !ctx.age || ctx.age > 60,
  },
  {
    matches: (n) => n.includes("potasyum") || n.includes("potassium"),
    condition: (v) => v.status !== "normal",
    urgencyBonus: 2,
    riskLabel: "kardiyak aritmi riski",
  },
  {
    matches: (n) => n.includes("sodyum") || n.includes("sodium"),
    condition: (v) => v.status !== "normal",
    urgencyBonus: 2,
    riskLabel: "hipo/hipernatremi → nörolojik risk",
  },
  {
    matches: (n) => n === "glu" || n.includes("glukoz") || n.includes("glucose"),
    condition: (v) => v.status === "critical",
    urgencyBonus: 2,
    riskLabel: "hipoglisemi/hiperglisemi krizi",
  },
  {
    matches: (n) => n.includes("troponin"),
    condition: (v) => v.status !== "normal",
    urgencyBonus: 3,
    riskLabel: "miyokardiyal hasar göstergesi",
  },
  {
    matches: (n) => n === "ddimer" || n.includes("d dimer"),
    condition: (v) => v.status === "high" || v.status === "critical",
    urgencyBonus: 2,
    riskLabel: "tromboembolik risk artışı",
  },
  {
    matches: (n) => n.includes("bilirubin"),
    condition: (v) => v.status === "high" || v.status === "critical",
    urgencyBonus: 2,
    riskLabel: "kolestaz / hepatoselüler hasar",
  },
  {
    matches: (n) => n === "alt" || n === "sgpt" || n === "ast" || n === "sgot",
    condition: (v) => v.status === "critical",
    urgencyBonus: 2,
    riskLabel: "akut hepatoselüler hasar",
  },
  {
    matches: (n) => n.includes("ferritin") || n.includes("demir") || n.includes("tdbk"),
    condition: (v) => v.status === "low",
    urgencyBonus: 1,
    riskLabel: "demir eksikliği",
    contextCondition: (ctx) => ctx.sex === "F",
  },
]

function applyHeuristics(
  v: LabValue,
  normalized: string,
  ctx: PatientContext,
): { bonus: number; riskNotes: string[] } {
  let bonus = 0
  const riskNotes: string[] = []
  for (const h of DOMAIN_HEURISTICS) {
    if (!h.matches(normalized)) continue
    if (!h.condition(v)) continue
    if (h.contextCondition && !h.contextCondition(ctx)) continue
    bonus += h.urgencyBonus
    riskNotes.push(h.riskLabel)
  }
  return { bonus, riskNotes }
}

// ── Scoring ──────────────────────────────────────────────────────────────────

function scoreDeviationMagnitude(v: LabValue): number {
  const num = parseFloat(v.value.replace(",", "."))
  if (isNaN(num)) return 0

  const { low, high, mode } = parseRefRange(v.refRange)

  if (mode === "range") {
    if (v.status === "high" && high !== null && high > 0) {
      const ratio = num / high
      if (ratio > 3) return 2
      if (ratio > 2) return 1
    }
    if (v.status === "low" && low !== null && low > 0) {
      const ratio = low / num
      if (ratio > 2) return 1
    }
  }

  if (mode === "lt" && high !== null && v.status === "high") {
    if (num > high * 3) return 2
    if (num > high * 2) return 1
  }

  if (mode === "gt" && low !== null && low > 0 && v.status === "low") {
    if (low / num > 2) return 1
  }

  return 0
}

function scoreClinicalImportance(
  v: LabValue,
  ctx: PatientContext,
): { score: number; riskNotes: string[] } {
  let score: number
  switch (v.status) {
    case "critical": score = 5; break
    case "high":     score = 3; break
    case "low":      score = 2; break
    default:         return { score: 0, riskNotes: [] }
  }

  const normalized = normalizeTestName(v.name)
  const { bonus, riskNotes } = applyHeuristics(v, normalized, ctx)

  score = Math.min(5, score + bonus + scoreDeviationMagnitude(v))

  // Age amplification: renal and cardiac tests are higher risk in elderly
  if (ctx.age && ctx.age > 65) {
    const isRenalCardiac = ["kreatinin", "creatinine", "potasyum", "sodyum", "troponin"]
      .some((k) => normalized.includes(k))
    if (isRenalCardiac) score = Math.min(5, score + 1)
  }

  return { score, riskNotes }
}

// ── Pipeline functions ───────────────────────────────────────────────────────

const IMPORTANCE_THRESHOLD = { primary: 4, secondary: 2 } as const

export function extractAbnormal(values: LabValue[]): LabValue[] {
  return values.filter((v) => v.status !== "normal")
}

export function groupBySystem(values: LabValue[]): Map<ClinicalSystem, LabValue[]> {
  const map = new Map<ClinicalSystem, LabValue[]>()
  for (const v of values) {
    const sys = detectSystem(v.name)
    map.set(sys, [...(map.get(sys) ?? []), v])
  }
  return map
}

export function rankByClinicalImportance(
  values: LabValue[],
  ctx: PatientContext = {},
): RankedLabValue[] {
  return values
    .map((v) => {
      const { score, riskNotes } = scoreClinicalImportance(v, ctx)
      return { ...v, system: detectSystem(v.name), importanceScore: score, riskNotes }
    })
    .sort((a, b) => b.importanceScore - a.importanceScore)
}

export function stratifyFindings(ranked: RankedLabValue[]): StratifiedFindings {
  const primary   = ranked.filter((v) => v.importanceScore >= IMPORTANCE_THRESHOLD.primary)
  const secondary = ranked.filter(
    (v) =>
      v.importanceScore >= IMPORTANCE_THRESHOLD.secondary &&
      v.importanceScore < IMPORTANCE_THRESHOLD.primary,
  )

  // If nothing qualifies as primary, promote the top-scored findings
  if (primary.length === 0 && ranked.length > 0) {
    return { primary: ranked.slice(0, Math.min(3, ranked.length)), secondary: [] }
  }

  return { primary, secondary }
}

// ── Prompt builders ──────────────────────────────────────────────────────────

const STATUS_LABEL: Record<LabValue["status"], string> = {
  critical: "KRİTİK",
  high:     "yüksek",
  low:      "düşük",
  normal:   "normal",
}

export function formatLabLine(v: RankedLabValue): string {
  const unit  = v.unit ? ` ${v.unit}` : ""
  const risks = v.riskNotes.length > 0 ? ` → ${v.riskNotes.join("; ")}` : ""
  return `- [${v.system}] ${v.name}: ${v.value}${unit} (${STATUS_LABEL[v.status]}, normal: ${v.refRange}, önem: ${v.importanceScore}/5)${risks}`
}

export function buildSystemPrompt(): string {
  return `Sen Türkçe konuşan bir tıbbi asistansın. SADECE TÜRKÇE yaz, İngilizce kullanma. Tanı koyma; klinik değerlendirme yap. Önce tüm bulguları birlikte değerlendir ve aralarındaki ilişkileri kur, sonra detaylara geç. Kısa ve net ol.`
}

function formatContextBlock(ctx: PatientContext): string {
  const lines: string[] = []
  if (ctx.age)             lines.push(`- Yaş: ${ctx.age}`)
  if (ctx.sex)             lines.push(`- Cinsiyet: ${ctx.sex === "M" ? "Erkek" : "Kadın"}`)
  if (ctx.symptoms?.length) lines.push(`- Semptomlar: ${ctx.symptoms.join(", ")}`)
  return lines.length > 0 ? `Hasta bilgileri:\n${lines.join("\n")}\n\n` : ""
}

function buildAbnormalUserPrompt(
  documentType: string,
  ranked: RankedLabValue[],
  grouped: Map<ClinicalSystem, LabValue[]>,
  ctx: PatientContext,
): string {
  const { primary, secondary } = stratifyFindings(ranked)

  const allLines       = ranked.map(formatLabLine).join("\n")
  const primaryLines   = primary.map(formatLabLine).join("\n")
  const secondaryLines = secondary.length > 0
    ? `\nDestekleyici bulgular (öncelikli olmayan):\n${secondary.map(formatLabLine).join("\n")}`
    : ""

  const affectedSystems = [...grouped.keys()]
    .filter((s) => s !== "Diğer")
    .join(", ") || "belirsiz"

  return `${formatContextBlock(ctx)}${documentType} raporunda ${ranked.length} anormal değer tespit edildi. Etkilenen sistemler: ${affectedSystems}.

Öncelikli bulgular (en kritik):
${primaryLines}${secondaryLines ? `\n\nDiğer bulgular:\n${secondaryLines}` : ""}

Bu bulguları birlikte değerlendirerek klinik önemlerini, aralarındaki ilişkileri ve olası nedenlerini Türkçe olarak kısaca açıkla. Sonunda 1-2 cümlelik genel özet yap.`
}

function buildNormalUserPrompt(documentType: string): string {
  return `${documentType} sonuçlarının tamamı normal aralıkta. Kısa ve bütüncül bir değerlendirme yap. Referans aralığına yakın sınır değerleri varsa özellikle belirt.`
}

function buildFallbackUserPrompt(documentType: string, fallbackText: string): string {
  return `Aşağıdaki ${documentType} metnini incele ve klinik değerlendirme yap. Önemli bulgular varsa önce genel tabloyu değerlendir, sonra detaylara geç.

METİN:
${fallbackText.slice(0, 1200)}`
}

export function buildUserPrompt(
  extractedValues: LabValue[],
  documentType: string,
  fallbackText: string,
  ctx: PatientContext = {},
): string {
  const abnormal = extractAbnormal(extractedValues)

  if (abnormal.length > 0) {
    const ranked  = rankByClinicalImportance(abnormal, ctx)
    const grouped = groupBySystem(abnormal)
    return buildAbnormalUserPrompt(documentType, ranked, grouped, ctx)
  }

  if (extractedValues.length > 0) return buildNormalUserPrompt(documentType)
  return buildFallbackUserPrompt(documentType, fallbackText)
}

function buildMessages(
  extractedValues: LabValue[],
  documentType: string,
  fallbackText: string,
  ctx: PatientContext = {},
): ChatMessage[] {
  return [
    { role: "system", content: buildSystemPrompt() },
    { role: "user",   content: buildUserPrompt(extractedValues, documentType, fallbackText, ctx) },
  ]
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function interpretLabReport(
  cleanedText: string,
  documentType: string,
  ctx: PatientContext = {},
): Promise<LabReportResult> {
  const extractedValues = parseLabValuesFromText(cleanedText)
  const messages        = buildMessages(extractedValues, documentType, cleanedText, ctx)

  const aiReport = await callBynara(messages, { maxTokens: 1200, temperature: 0.2 })

  return { extractedValues, aiReport }
}
