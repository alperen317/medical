import { PlayCircle, FileInput, GitBranch, FileStack, ListTodo, CheckCircle2, type LucideIcon } from "lucide-react"
import type { WorkflowNodeType } from "./types"

// Studio (tasarım zamanı) ve Intake (çalışma zamanı) aynı ikon/renk dilini
// kullansın diye tek yerden paylaşılıyor — bir node tipi ikisinde de aynı
// görünür.
export const NODE_VISUALS: Record<WorkflowNodeType, { icon: LucideIcon; color: string; bg: string }> = {
  start: { icon: PlayCircle, color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800" },
  form: { icon: FileInput, color: "text-blue-700 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800" },
  decision: { icon: GitBranch, color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800" },
  document: { icon: FileStack, color: "text-violet-700 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-950/40 border-violet-300 dark:border-violet-800" },
  task: { icon: ListTodo, color: "text-teal-700 dark:text-teal-400", bg: "bg-teal-50 dark:bg-teal-950/40 border-teal-300 dark:border-teal-800" },
  end: { icon: CheckCircle2, color: "text-rose-700 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800" },
}

// Decision node'un then/else dallarının rengi — Studio canvas'taki edge
// renkleriyle birebir aynı tutulur (workflow-canvas.tsx toFlowEdges).
export const BRANCH_COLORS = {
  then: { text: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/40" },
  else: { text: "text-rose-700 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-950/40" },
}
