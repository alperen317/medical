"use client"

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react"
import type { WorkflowNodeType } from "@/lib/workflow/types"
import { NODE_VISUALS } from "@/lib/workflow/node-visuals"

export type WorkflowNodeData = {
  label: string
  sublabel?: string
}

export type WorkflowFlowNode = Node<WorkflowNodeData, WorkflowNodeType>

function BaseNode({ type, data, selected }: NodeProps<WorkflowFlowNode>) {
  const style = NODE_VISUALS[type as WorkflowNodeType]
  const Icon = style.icon

  return (
    <div
      className={`min-w-[160px] rounded-lg border-2 px-3 py-2 shadow-sm ${style.bg} ${selected ? "ring-2 ring-primary" : ""}`}
    >
      {type !== "start" && <Handle type="target" position={Position.Left} className="!bg-muted-foreground" />}
      <div className="flex items-center gap-1.5">
        <Icon className={`h-4 w-4 shrink-0 ${style.color}`} />
        <span className="text-sm font-semibold truncate">{data.label}</span>
      </div>
      {data.sublabel && (
        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{data.sublabel}</p>
      )}
      {type === "decision" ? (
        <>
          <Handle type="source" position={Position.Right} id="then" style={{ top: "35%" }} className="!bg-emerald-600" />
          <Handle type="source" position={Position.Right} id="else" style={{ top: "70%" }} className="!bg-rose-600" />
        </>
      ) : type !== "end" ? (
        <Handle type="source" position={Position.Right} className="!bg-muted-foreground" />
      ) : null}
    </div>
  )
}

export const workflowNodeTypes = {
  start: BaseNode,
  form: BaseNode,
  decision: BaseNode,
  document: BaseNode,
  task: BaseNode,
  end: BaseNode,
}
