import "server-only"
import { prisma } from "@/lib/prisma"
import { getFormDefinitions, getFormDefinitionsByIds } from "@/lib/db/workflow-studio"
import { reconstructVisitedPath } from "@/lib/workflow/path"
import type { WorkflowGraph } from "@/lib/workflow/types"

export async function getPublishedWorkflowDefinitions() {
  return prisma.workflowDefinition.findMany({
    where: { status: "published" },
    orderBy: { name: "asc" },
  })
}

export async function getWorkflowInstances() {
  return prisma.workflowInstance.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      patient: true,
      workflowDef: { select: { id: true, name: true, branch: true } },
    },
  })
}

export type WorkflowInstanceRow = Awaited<ReturnType<typeof getWorkflowInstances>>[number]

export async function getWorkflowInstanceById(id: string) {
  return prisma.workflowInstance.findUnique({
    where: { id },
    include: {
      patient: true,
      workflowDef: true,
      documents: { orderBy: { createdAt: "desc" } },
    },
  })
}

export async function getRuleConditionsMap() {
  const rules = await prisma.ruleDefinition.findMany({ select: { id: true, condition: true } })
  return new Map(rules.map((r) => [r.id, r.condition as { field: string; operator: "equals" | "not_equals"; value: string | number | boolean }]))
}

// Intake runner (canlı süreç) ve /patients/[id] (tamamlanmış Son Kontrol özeti,
// birebir aynı görünüm) aynı montajı paylaşır: rota + o rotada kullanılan form
// tanımları (bkz. IntakeSummary). Tek yerden üretilip iki yerde de kullanılır.
export async function getIntakeSummaryContext(instanceId: string) {
  const instance = await getWorkflowInstanceById(instanceId)
  if (!instance) return null

  const graph = (instance.workflowDef.nodes as unknown as WorkflowGraph).nodes
  const latestForms = await getFormDefinitions()
  const rulesMap = await getRuleConditionsMap()
  const history = Array.isArray(instance.history) ? (instance.history as string[]) : []
  const answers = instance.answers as Record<string, unknown>
  const visitedPath = reconstructVisitedPath(graph, history, instance.currentNodeId, answers, (id) => rulesMap.get(id))

  // Ziyaret edilen rotadaki form adımları, o formun sonradan güncellenmiş
  // (artık "güncel" olmayan) bir versiyonuna sabitlenmiş olabilir — özet
  // ekranında ismini/alanlarını doğru göstermek için bunlar da ayrıca çekilir.
  const visitedFormIds = visitedPath
    .filter((s): s is Extract<typeof s, { kind: "form" }> => s.kind === "form" && !!s.node.formId)
    .map((s) => s.node.formId!)
  const missingFormIds = [...new Set(visitedFormIds)].filter((fid) => !latestForms.some((f) => f.id === fid))
  const staleForms = await getFormDefinitionsByIds(missingFormIds)
  const forms = [...latestForms, ...staleForms]

  return { instance, forms, visitedPath, graph, rulesMap, answers }
}

// Bu gerçek Patient kaydını doğuran (ya da onunla eşleşen) en güncel tamamlanmış
// kabul süreci — /patients/[id] sayfasında Son Kontrol özetini göstermek için.
export async function getCompletedIntakeInstanceIdForPatient(patientId: string) {
  const instance = await prisma.workflowInstance.findFirst({
    where: { promotedPatientId: patientId, status: "completed" },
    orderBy: { completedAt: "desc" },
    select: { id: true },
  })
  return instance?.id ?? null
}
