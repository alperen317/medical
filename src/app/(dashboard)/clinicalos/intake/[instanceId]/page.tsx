import { notFound } from "next/navigation"
import { verifySession, requirePermission } from "@/lib/dal"
import { getIntakeSummaryContext } from "@/lib/db/clinicalos-intake"
import { getFormDefinitionById } from "@/lib/db/workflow-studio"
import { IntakeRunner } from "./_components/intake-runner"

interface Props {
  params: Promise<{ instanceId: string }>
}

export default async function IntakeRunnerPage({ params }: Props) {
  const currentUser = await verifySession()
  requirePermission(currentUser, "intake:execute")

  const { instanceId } = await params
  const context = await getIntakeSummaryContext(instanceId)
  if (!context) notFound()

  const { instance, forms, visitedPath, graph } = context
  const currentNode = graph.find((n) => n.id === instance.currentNodeId)
  if (!currentNode) notFound()

  const formDef =
    currentNode.type === "form" && currentNode.formId
      ? await getFormDefinitionById(currentNode.formId)
      : null

  return (
    <IntakeRunner
      instance={instance}
      currentNode={currentNode}
      formDef={formDef}
      forms={forms}
      visitedPath={visitedPath}
    />
  )
}
