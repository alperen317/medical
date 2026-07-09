import "server-only"
import { prisma } from "@/lib/prisma"

export async function getWorkflowDefinitions() {
  return prisma.workflowDefinition.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { instances: true } } },
  })
}

export type WorkflowDefinitionWithCount = Awaited<ReturnType<typeof getWorkflowDefinitions>>[number]

export async function getWorkflowDefinitionById(id: string) {
  return prisma.workflowDefinition.findUnique({ where: { id } })
}

// Sadece her versiyon ailesinin (rootId) güncel sürümü — Form Builder listesi
// ve Studio'daki form seçim dropdown'u için. Eski sürümler burada görünmez ama
// hâlâ id'leriyle sorgulanabilir (bkz. getFormDefinitionById / ByIds) çünkü
// satırlar hiç silinmez/değiştirilmez.
export async function getFormDefinitions() {
  return prisma.formDefinition.findMany({ where: { isLatest: true }, orderBy: { updatedAt: "desc" } })
}

export type FormDefinitionRow = Awaited<ReturnType<typeof getFormDefinitions>>[number]

export async function getFormDefinitionById(id: string) {
  return prisma.formDefinition.findUnique({ where: { id } })
}

// Bir workflow'un node'ları güncel-olmayan (eski) bir forma sabitlenmiş olabilir
// — bu satırlar getFormDefinitions()'ta artık listelenmez, isimlerini Studio'da
// doğru göstermek için id ile ayrıca çekilir.
export async function getFormDefinitionsByIds(ids: string[]) {
  if (ids.length === 0) return []
  return prisma.formDefinition.findMany({ where: { id: { in: ids } } })
}

export async function getRuleDefinitions() {
  return prisma.ruleDefinition.findMany({ orderBy: { updatedAt: "desc" } })
}

export type RuleDefinitionRow = Awaited<ReturnType<typeof getRuleDefinitions>>[number]
