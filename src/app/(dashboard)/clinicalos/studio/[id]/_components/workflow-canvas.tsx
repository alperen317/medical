"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  applyNodeChanges,
  useReactFlow,
  useNodesInitialized,
  type Connection,
  type NodeChange,
  type EdgeChange,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { ArrowLeft, Loader2, Save, FileInput, GitBranch, FileStack, ListTodo, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { updateWorkflowNodesAction, publishWorkflowDefinitionAction } from "@/lib/actions/workflow-studio"
import type { FormDefinitionRow, RuleDefinitionRow } from "@/lib/db/workflow-studio"
import type { WorkflowNode, WorkflowNodeType } from "@/lib/workflow/types"
import { autoLayout } from "@/lib/workflow/layout"
import { workflowNodeTypes, type WorkflowFlowNode } from "./workflow-nodes"
import { NodePropertyPanel } from "./node-property-panel"
import { toast } from "@/store/ui.store"
import { useT } from "@/store/translations-context"
import type { TranslationKey } from "@/lib/i18n/defaults"

type Props = {
  workflow: { id: string; name: string; status: string; nodes: unknown }
  forms: FormDefinitionRow[]
  rules: RuleDefinitionRow[]
}

const NODE_TYPE_BUTTONS: { type: WorkflowNodeType; labelKey: TranslationKey; icon: React.ElementType }[] = [
  { type: "form", labelKey: "workflow.editor.node.form", icon: FileInput },
  { type: "decision", labelKey: "workflow.editor.node.decision", icon: GitBranch },
  { type: "document", labelKey: "workflow.editor.node.document", icon: FileStack },
  { type: "task", labelKey: "workflow.editor.node.task", icon: ListTodo },
  { type: "end", labelKey: "workflow.editor.node.end", icon: CheckCircle2 },
]

function toFlowNode(node: WorkflowNode, forms: FormDefinitionRow[], rules: RuleDefinitionRow[], t: (key: TranslationKey) => string): WorkflowFlowNode {
  const labelMap: Record<WorkflowNodeType, string> = {
    start: "Start",
    form: t("workflow.editor.node.form"),
    decision: t("workflow.editor.node.decision"),
    document: t("workflow.editor.node.document"),
    task: t("workflow.editor.node.task"),
    end: t("workflow.editor.node.end"),
  }
  let sublabel: string | undefined
  if (node.type === "form") sublabel = forms.find((f) => f.id === node.formId)?.name ?? node.formId
  if (node.type === "decision") sublabel = rules.find((r) => r.id === node.ruleId)?.name ?? node.ruleId
  if (node.type === "document") sublabel = node.documentType
  if (node.type === "task") sublabel = node.label
  if (node.type === "start" || node.type === "end") sublabel = node.id

  return {
    id: node.id,
    type: node.type,
    position: node.position ?? { x: 0, y: 0 },
    data: { label: labelMap[node.type], sublabel },
  }
}

// Edge id ayracı "::" — node id'leri ("tani_var_mi" gibi) tire/altçizgi
// içerebildiği için "-" ile parse etmek güvenli değil.
function toFlowEdges(nodes: WorkflowNode[], t: (key: TranslationKey) => string) {
  const edges: { id: string; source: string; target: string; sourceHandle?: string; style?: React.CSSProperties; label?: string }[] = []
  for (const node of nodes) {
    if (node.type === "decision") {
      if (node.then) edges.push({ id: `${node.id}::then`, source: node.id, target: node.then, sourceHandle: "then", style: { stroke: "#059669" }, label: t("common.yes").toLowerCase() })
      if (node.else) edges.push({ id: `${node.id}::else`, source: node.id, target: node.else, sourceHandle: "else", style: { stroke: "#e11d48" }, label: t("common.no").toLowerCase() })
    } else if (node.type !== "end" && node.next) {
      edges.push({ id: `${node.id}::next`, source: node.id, target: node.next })
    }
  }
  return edges
}

function FitViewOnInit() {
  const { fitView } = useReactFlow()
  const nodesInitialized = useNodesInitialized()

  useEffect(() => {
    if (nodesInitialized) fitView({ padding: 0.2 })
  }, [nodesInitialized, fitView])

  return null
}

export function WorkflowCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner {...props} />
    </ReactFlowProvider>
  )
}

function WorkflowCanvasInner({ workflow, forms, rules }: Props) {
  const t = useT()
  const [pending, startTransition] = useTransition()
  const [publishPending, startPublishTransition] = useTransition()

  const initialDomain = useMemo(
    () => autoLayout((workflow.nodes as { nodes: WorkflowNode[] }).nodes),
    [workflow.nodes],
  )

  // İki katmanlı state: `domain` bağlantı + config'in (next/then/else, formId vb.)
  // doğruluk kaynağı; `flowNodes` ise React Flow'un kontrollü node dizisi.
  // React Flow v12, node'ları `measured` boyutları geri yazılana kadar gizli
  // render eder — bu yüzden applyNodeChanges çıktısı olduğu gibi saklanmalı,
  // her render'da domain'den yeniden üretilmemeli.
  const [domain, setDomain] = useState<WorkflowNode[]>(initialDomain)
  const [flowNodes, setFlowNodes] = useState<WorkflowFlowNode[]>(() =>
    initialDomain.map((n) => toFlowNode(n, forms, rules, t)),
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const flowEdges = useMemo(() => toFlowEdges(domain, t), [domain, t])
  const selectedNode = domain.find((n) => n.id === selectedId) ?? null

  const onNodesChange = useCallback((changes: NodeChange<WorkflowFlowNode>[]) => {
    setFlowNodes((prev) => applyNodeChanges(changes, prev))
  }, [])

  // Dikkat: `"next" in n` runtime'da objenin gerçek key'lerine bakar — yeni
  // eklenen node'larda `next` key'i hiç olmadığı için bağlantı sessizce
  // kaybolur. Bu yüzden tip üzerinden (`n.type !== "end"`) daraltıyoruz.
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    for (const change of changes) {
      if (change.type === "remove") {
        const [sourceId, kind] = change.id.split("::")
        setDomain((prev) =>
          prev.map((n) => {
            if (n.id !== sourceId) return n
            if (n.type === "decision") {
              if (kind === "then") return { ...n, then: undefined }
              if (kind === "else") return { ...n, else: undefined }
              return n
            }
            if (n.type === "end") return n
            return { ...n, next: undefined }
          }),
        )
      }
    }
  }, [])

  const onConnect = useCallback((connection: Connection) => {
    setDomain((prev) =>
      prev.map((n) => {
        if (n.id !== connection.source) return n
        if (n.type === "decision") {
          if (connection.sourceHandle === "then") return { ...n, then: connection.target }
          if (connection.sourceHandle === "else") return { ...n, else: connection.target }
          return n
        }
        if (n.type === "end") return n
        return { ...n, next: connection.target }
      }),
    )
  }, [])

  const updateNode = (next: WorkflowNode) => {
    setDomain((prev) => prev.map((n) => (n.id === next.id ? next : n)))
    // Property panel değişikliği node kartındaki alt etiketi de etkiler.
    const fresh = toFlowNode(next, forms, rules, t)
    setFlowNodes((prev) => prev.map((f) => (f.id === next.id ? { ...f, data: fresh.data } : f)))
  }

  const addNode = (type: WorkflowNodeType) => {
    const id = `node_${crypto.randomUUID().slice(0, 8)}`
    const maxX = flowNodes.reduce((max, n) => Math.max(max, n.position.x), 0)
    const base = { id, position: { x: maxX + 220, y: 40 } }
    let newNode: WorkflowNode
    switch (type) {
      case "form": newNode = { ...base, type: "form" }; break
      case "decision": newNode = { ...base, type: "decision" }; break
      case "document": newNode = { ...base, type: "document" }; break
      case "task": newNode = { ...base, type: "task" }; break
      case "end": newNode = { ...base, type: "end" }; break
      default: return
    }
    setDomain((prev) => [...prev, newNode])
    setFlowNodes((prev) => [...prev, toFlowNode(newNode, forms, rules, t)])
    setSelectedId(id)
  }

  const deleteNode = (id: string) => {
    setDomain((prev) =>
      prev
        .filter((n) => n.id !== id)
        .map((n) => {
          if (n.type === "decision") {
            return {
              ...n,
              then: n.then === id ? undefined : n.then,
              else: n.else === id ? undefined : n.else,
            }
          }
          if (n.type !== "end" && n.next === id) return { ...n, next: undefined }
          return n
        }),
    )
    setFlowNodes((prev) => prev.filter((f) => f.id !== id))
    setSelectedId(null)
  }

  const save = () => {
    // Güncel pozisyonlar React Flow state'inde — kayıttan önce domain'e birleştir.
    const merged = domain.map((n) => {
      const f = flowNodes.find((fn) => fn.id === n.id)
      return f ? { ...n, position: { x: f.position.x, y: f.position.y } } : n
    })
    setDomain(merged)
    startTransition(async () => {
      const result = await updateWorkflowNodesAction(workflow.id, { nodes: merged })
      if (result.success) toast.success(result.message ?? "Kaydedildi")
      else toast.error(result.message ?? "Kaydedilemedi")
    })
  }

  const togglePublish = () => {
    startPublishTransition(async () => {
      const result = await publishWorkflowDefinitionAction(workflow.id)
      if (result.success) toast.success(result.message ?? "Güncellendi")
      else toast.error(result.message ?? "Güncellenemedi")
    })
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex items-center justify-between gap-2 border-b bg-card px-4 py-2 shrink-0 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Link href="/clinicalos/studio">
            <Button variant="ghost" size="sm" className="gap-2 -ml-2">
              <ArrowLeft className="h-4 w-4" />
              {t("workflow.editor.back_button")}
            </Button>
          </Link>
          <div className="h-4 w-px bg-border" />
          <p className="text-sm font-semibold truncate">{workflow.name}</p>
          <Badge variant={workflow.status === "published" ? "success" : "outline"} className="text-xs">
            {workflow.status === "published" ? t("workflow.status.published") : t("workflow.status.draft")}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {NODE_TYPE_BUTTONS.map((btn) => (
            <Button key={btn.type} variant="outline" size="sm" className="gap-1.5" onClick={() => addNode(btn.type)}>
              <btn.icon className="h-3.5 w-3.5" />
              {t(btn.labelKey)}
            </Button>
          ))}
          <div className="h-4 w-px bg-border mx-1" />
          <Button variant="outline" size="sm" onClick={togglePublish} disabled={publishPending}>
            {publishPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : workflow.status === "draft" ? t("workflow.editor.publish_button") : t("workflow.editor.unpublish_button")}
          </Button>
          <Button size="sm" className="gap-1.5" onClick={save} disabled={pending}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {t("workflow.editor.save_button")}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 min-w-0">
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={workflowNodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedId(node.id)}
            onPaneClick={() => setSelectedId(null)}
          >
            <FitViewOnInit />
            <Background />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
        </div>

        {selectedNode && (
          <NodePropertyPanel
            node={selectedNode}
            forms={forms}
            rules={rules}
            onChange={updateNode}
            onDelete={() => deleteNode(selectedNode.id)}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>
    </div>
  )
}
