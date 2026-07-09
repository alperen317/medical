import type { WorkflowNode } from "./types"

const LAYER_WIDTH = 220
const ROW_HEIGHT = 110

function outgoing(node: WorkflowNode): string[] {
  switch (node.type) {
    case "start":
    case "form":
    case "document":
    case "task":
      return node.next ? [node.next] : []
    case "decision":
      return [node.then, node.else].filter((x): x is string => Boolean(x))
    case "end":
      return []
  }
}

/**
 * Pozisyonu olmayan node'lar için basit soldan-sağa katmanlı yerleşim.
 * BFS ile "start" node'undan katman (x) hesaplanır, katman içi sıra (y) belirlenir.
 */
export function autoLayout(nodes: WorkflowNode[]): WorkflowNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const layer = new Map<string, number>()
  const start = nodes.find((n) => n.type === "start")

  if (start) {
    const queue: string[] = [start.id]
    layer.set(start.id, 0)
    while (queue.length > 0) {
      const id = queue.shift()!
      const node = byId.get(id)
      if (!node) continue
      const depth = layer.get(id) ?? 0
      for (const nextId of outgoing(node)) {
        if (!layer.has(nextId) || layer.get(nextId)! < depth + 1) {
          layer.set(nextId, depth + 1)
          queue.push(nextId)
        }
      }
    }
  }

  let fallbackLayer = 0
  const rowByLayer = new Map<number, number>()

  return nodes.map((node) => {
    if (node.position) return node
    const l = layer.has(node.id) ? layer.get(node.id)! : fallbackLayer++
    const row = rowByLayer.get(l) ?? 0
    rowByLayer.set(l, row + 1)
    return { ...node, position: { x: l * LAYER_WIDTH, y: row * ROW_HEIGHT } }
  })
}
