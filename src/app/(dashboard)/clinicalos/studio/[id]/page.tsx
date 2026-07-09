import { notFound } from "next/navigation"
import { verifySession, requirePermission } from "@/lib/dal"
import {
  getWorkflowDefinitionById,
  getFormDefinitions,
  getFormDefinitionsByIds,
  getRuleDefinitions,
} from "@/lib/db/workflow-studio"
import type { WorkflowGraph } from "@/lib/workflow/types"
import { WorkflowCanvas } from "./_components/workflow-canvas"

interface Props {
  params: Promise<{ id: string }>
}

export default async function WorkflowEditorPage({ params }: Props) {
  const currentUser = await verifySession()
  requirePermission(currentUser, "workflow:manage")

  const { id } = await params
  const [workflow, latestForms, rules] = await Promise.all([
    getWorkflowDefinitionById(id),
    getFormDefinitions(),
    getRuleDefinitions(),
  ])
  if (!workflow) notFound()

  // Bu workflow'un node'ları artık güncel olmayan bir form versiyonuna sabit
  // olabilir (form sonradan düzenlendi) — o versiyon getFormDefinitions()'ta
  // görünmez, ismini doğru göstermek için ayrıca çekiliyor.
  const graphNodes = (workflow.nodes as unknown as WorkflowGraph).nodes ?? []
  const referencedIds = graphNodes
    .filter((n): n is Extract<typeof n, { type: "form" }> => n.type === "form" && !!n.formId)
    .map((n) => n.formId!)
  const missingIds = referencedIds.filter((fid) => !latestForms.some((f) => f.id === fid))
  const staleForms = await getFormDefinitionsByIds(missingIds)
  const forms = [...latestForms, ...staleForms]

  return <WorkflowCanvas workflow={workflow} forms={forms} rules={rules} />
}
