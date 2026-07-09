export type WorkflowNodeType = "start" | "form" | "decision" | "document" | "task" | "end"

export type NodePosition = { x: number; y: number }

type BaseNode = {
  id: string
  type: WorkflowNodeType
  position?: NodePosition
}

export type StartNode = BaseNode & { type: "start"; next?: string }
export type FormNode = BaseNode & { type: "form"; formId?: string; next?: string }
export type DecisionNode = BaseNode & { type: "decision"; ruleId?: string; then?: string; else?: string }
export type DocumentChecklistItem = {
  label: string
  required: boolean
  category?: "patoloji" | "goruntuleme" | "laboratuvar" | "diger"
}

export type DocumentNode = BaseNode & {
  type: "document"
  documentType?: string
  checklist?: DocumentChecklistItem[]
  next?: string
}
export type TaskNode = BaseNode & { type: "task"; label?: string; next?: string }
export type EndNode = BaseNode & { type: "end" }

export type WorkflowNode = StartNode | FormNode | DecisionNode | DocumentNode | TaskNode | EndNode

export type WorkflowGraph = { nodes: WorkflowNode[] }

export type FormFieldType = "text" | "number" | "date" | "boolean" | "select" | "textarea" | "file"

export type FormField = {
  id: string
  type: FormFieldType
  label: string
  required: boolean
  options?: string[]
}

export type RuleCondition = {
  field: string
  operator: "equals" | "not_equals"
  value: string | number | boolean
}
