import type { WorkflowNode, RuleCondition } from "./types"
import { evaluateRule } from "./engine"

export type PathStep =
  | { kind: "form"; node: Extract<WorkflowNode, { type: "form" }> }
  | { kind: "document"; node: Extract<WorkflowNode, { type: "document" }> }
  | { kind: "task"; node: Extract<WorkflowNode, { type: "task" }> }
  | { kind: "end"; node: Extract<WorkflowNode, { type: "end" }> }
  | { kind: "decision"; node: Extract<WorkflowNode, { type: "decision" }>; branch: "then" | "else" }

/**
 * `history` (ziyaret edilen actionable node id'leri) + şu anki node'dan,
 * start node'dan başlayarak aradaki Decision node'ları da (hangi dala
 * gidildiğiyle birlikte) içeren tam rotayı yeniden kurar. Decision node'lar
 * hiçbir zaman `history`'e girmez (motor onları otomatik atlar) — bu yüzden
 * aralarındaki bağlantı `next`/`then`/`else` takip edilerek yeniden hesaplanır.
 * `answers` o anki (en güncel) durumu yansıtır; geçmişte verilmiş bir cevap
 * sonradan düzeltilirse rota da güncel cevaba göre yeniden okunur.
 */
export function reconstructVisitedPath(
  nodes: WorkflowNode[],
  history: string[],
  currentNodeId: string,
  answers: Record<string, unknown>,
  getRuleCondition: (ruleId: string) => RuleCondition | undefined,
): PathStep[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const start = nodes.find((n) => n.type === "start")
  const checkpoints = [start?.id ?? currentNodeId, ...history, currentNodeId]

  const steps: PathStep[] = []
  for (let i = 0; i < checkpoints.length - 1; i++) {
    const from = byId.get(checkpoints[i])
    const to = checkpoints[i + 1]
    if (!from) continue

    let cursor = from.type !== "decision" && from.type !== "end" ? from.next : undefined
    let guard = 0
    while (cursor && guard < nodes.length + 1) {
      const node = byId.get(cursor)
      if (!node || node.type !== "decision") break
      const condition = node.ruleId ? getRuleCondition(node.ruleId) : undefined
      const branch: "then" | "else" = condition ? (evaluateRule(condition, answers) ? "then" : "else") : "else"
      steps.push({ kind: "decision", node, branch })
      cursor = branch === "then" ? node.then : node.else
      guard++
    }

    const target = byId.get(to)
    if (target && target.type !== "start" && target.type !== "decision") {
      steps.push({ kind: target.type, node: target } as PathStep)
    }
  }
  return steps
}

export function humanize(id: string): string {
  return id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

// Onkoloji seed'indeki (prisma/seed-clinicalos.ts) kanser tipi anahtarları için
// okunabilir Türkçe başlıklar — document-step.tsx'teki DOCUMENT_TYPE_LABELS ile
// aynı metinler (orada "oncology_" önekiyle, burada çıplak anahtarla kullanılır)
// — aynı tip iki yerde farklı yazılmasın diye. Kısaltmalar (ör. "mss") burada
// kelime kelime büyütülmez, tam adıyla yazılır.
const CANCER_TYPE_LABELS: Record<string, string> = {
  meme: "Meme",
  akciger: "Akciğer",
  kolorektal: "Kolorektal",
  prostat: "Prostat",
  mss: "Beyin / Omurilik (MSS)",
  over: "Over",
  pankreas: "Pankreas",
  karaciger: "Karaciğer",
  lenfoma: "Lenfoma",
  losemi: "Lösemi",
  diger: "Diğer Onkolojik",
}

// Onkoloji seed'indeki (prisma/seed-clinicalos.ts) kanser tipi decision node'ları
// "kanser_<tip>_check" biçiminde id'lenir — ham haliyle gösterilirse (ör. "Kanser
// Kolorektal Check") art arda gelen birden fazla decision adımı ayırt edilemez,
// hepsi aynı görünür. Burada sadece <tip> kısmı öne çıkarılıyor.
export function humanizeDecision(id: string): string {
  const key = id.replace(/^kanser_/, "").replace(/_check$/, "")
  return CANCER_TYPE_LABELS[key] ?? humanize(key)
}

// Bu zincirdeki her "check" sırayla bir kanser tipini eler: "Hayır" sadece "bu
// tip değil, sıradakine bak" demek — tek başına klinik bir anlam taşımıyor.
// Yalnızca eşleşen tip (Evet) gösterime değer; ara "Hayır"lar gürültü. Rota
// (StepTrace) ve Son Kontrol/Özet (IntakeSummary) aynı filtreyi paylaşır.
export function isEliminationCheck(id: string): boolean {
  return id.startsWith("kanser_") && id.endsWith("_check")
}

export function visiblePathSteps(steps: PathStep[]): PathStep[] {
  return steps.filter((step) => !(step.kind === "decision" && step.branch === "else" && isEliminationCheck(step.node.id)))
}
