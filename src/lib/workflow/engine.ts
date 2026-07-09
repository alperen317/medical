import type { RuleCondition, WorkflowNode } from "./types"

export function evaluateRule(condition: RuleCondition, answers: Record<string, unknown>): boolean {
  const actual = answers[condition.field]
  if (condition.operator === "equals") return actual === condition.value
  return actual !== condition.value
}

type ResolveDeps = {
  getRuleCondition: (ruleId: string) => RuleCondition | undefined
}

/**
 * "start" ve "decision" node'larını otomatik atlayarak kullanıcının görmesi
 * gereken ilk actionable node'u (form/document/task/end) döndürür.
 * Decision node'lar UI'da hiç görünmez, sadece routing mantığıdır.
 */
export function resolveActionableNode(
  startNodeId: string,
  nodes: WorkflowNode[],
  answers: Record<string, unknown>,
  deps: ResolveDeps,
): WorkflowNode {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  let current = byId.get(startNodeId)
  if (!current) throw new Error(`Node bulunamadı: ${startNodeId}`)

  const visited = new Set<string>()
  while (current.type === "start" || current.type === "decision") {
    if (visited.has(current.id)) throw new Error(`Workflow döngüsü tespit edildi: ${current.id}`)
    visited.add(current.id)

    let nextId: string | undefined
    if (current.type === "start") {
      nextId = current.next
    } else {
      const condition = current.ruleId ? deps.getRuleCondition(current.ruleId) : undefined
      const result = condition ? evaluateRule(condition, answers) : false
      nextId = result ? current.then : current.else
    }
    if (!nextId) throw new Error(`Node'un devam bağlantısı yok: ${current.id}`)

    const next = byId.get(nextId)
    if (!next) throw new Error(`Node bulunamadı: ${nextId}`)
    current = next
  }

  return current
}
