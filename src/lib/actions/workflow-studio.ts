"use server"

import { prisma } from "@/lib/prisma"
import { verifySession, requirePermission } from "@/lib/dal"
import { z } from "zod/v4"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { logActivity } from "@/lib/db/activity"
import type { WorkflowGraph } from "@/lib/workflow/types"

export type ActionState = {
  errors?: Record<string, string[]>
  message?: string
  success?: boolean
}

const WorkflowDefinitionSchema = z.object({
  name: z.string().min(2, "İsim en az 2 karakter olmalıdır"),
  branch: z.string().min(2, "Branş en az 2 karakter olmalıdır"),
})

const DEFAULT_GRAPH: WorkflowGraph = {
  nodes: [
    { id: "start", type: "start", next: "end", position: { x: 0, y: 0 } },
    { id: "end", type: "end", position: { x: 280, y: 0 } },
  ],
}

export async function createWorkflowDefinitionAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const currentUser = await verifySession()
  requirePermission(currentUser, "workflow:manage")

  const result = WorkflowDefinitionSchema.safeParse({
    name: formData.get("name"),
    branch: formData.get("branch"),
  })
  if (!result.success) return { errors: result.error.flatten().fieldErrors }

  const created = await prisma.workflowDefinition.create({
    data: {
      name: result.data.name,
      branch: result.data.branch,
      status: "draft",
      version: 1,
      nodes: DEFAULT_GRAPH,
    },
  })

  revalidatePath("/clinicalos/studio")
  void logActivity({
    actorId: currentUser.userId,
    action: "workflow.create",
    entityType: "workflow_definition",
    entityId: created.id,
    entityLabel: created.name,
  }).catch(console.error)

  redirect(`/clinicalos/studio/${created.id}`)
}

const RenameWorkflowSchema = z.object({
  name: z.string().min(2, "İsim en az 2 karakter olmalıdır"),
})

export async function renameWorkflowDefinitionAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const currentUser = await verifySession()
  requirePermission(currentUser, "workflow:manage")

  const id = formData.get("id") as string
  if (!id) return { message: "Workflow ID gerekli." }

  const result = RenameWorkflowSchema.safeParse({ name: formData.get("name") })
  if (!result.success) return { errors: result.error.flatten().fieldErrors }

  const workflow = await prisma.workflowDefinition.findUnique({ where: { id } })
  if (!workflow) return { message: "Workflow bulunamadı." }

  const oldName = workflow.name
  await prisma.workflowDefinition.update({ where: { id }, data: { name: result.data.name } })

  revalidatePath("/clinicalos/studio")
  revalidatePath(`/clinicalos/studio/${id}`)
  void logActivity({
    actorId: currentUser.userId,
    action: "workflow.rename",
    entityType: "workflow_definition",
    entityId: id,
    entityLabel: result.data.name,
    metadata: { oldName, newName: result.data.name },
  }).catch(console.error)

  return { success: true, message: "Workflow adı güncellendi." }
}

export async function updateWorkflowNodesAction(id: string, nodes: WorkflowGraph): Promise<ActionState> {
  const currentUser = await verifySession()
  requirePermission(currentUser, "workflow:manage")

  const workflow = await prisma.workflowDefinition.findUnique({ where: { id } })
  if (!workflow) return { message: "Workflow bulunamadı." }

  await prisma.workflowDefinition.update({ where: { id }, data: { nodes } })
  revalidatePath(`/clinicalos/studio/${id}`)
  void logActivity({
    actorId: currentUser.userId,
    action: "workflow.update_nodes",
    entityType: "workflow_definition",
    entityId: id,
    entityLabel: workflow.name,
  }).catch(console.error)

  return { success: true, message: "Workflow kaydedildi." }
}

export async function publishWorkflowDefinitionAction(id: string): Promise<ActionState> {
  const currentUser = await verifySession()
  requirePermission(currentUser, "workflow:manage")

  const workflow = await prisma.workflowDefinition.findUnique({ where: { id } })
  if (!workflow) return { message: "Workflow bulunamadı." }

  const nextStatus = workflow.status === "draft" ? "published" : "draft"
  await prisma.workflowDefinition.update({ where: { id }, data: { status: nextStatus } })
  revalidatePath(`/clinicalos/studio/${id}`)
  revalidatePath("/clinicalos/studio")
  void logActivity({
    actorId: currentUser.userId,
    action: nextStatus === "published" ? "workflow.publish" : "workflow.unpublish",
    entityType: "workflow_definition",
    entityId: id,
    entityLabel: workflow.name,
  }).catch(console.error)

  return { success: true, message: nextStatus === "published" ? "Workflow yayınlandı." : "Workflow taslağa alındı." }
}

export async function deleteWorkflowDefinitionAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const currentUser = await verifySession()
  requirePermission(currentUser, "workflow:manage")

  const id = formData.get("id") as string
  if (!id) return { message: "Workflow ID gerekli." }

  const workflow = await prisma.workflowDefinition.findUnique({
    where: { id },
    include: { _count: { select: { instances: true } } },
  })
  if (!workflow) return { message: "Workflow bulunamadı." }
  if (workflow._count.instances > 0) {
    return {
      message: `Bu workflow'a bağlı ${workflow._count.instances} kabul kaydı var, silinemez. Kullanımdan kaldırmak için taslağa alın.`,
    }
  }

  await prisma.workflowDefinition.delete({ where: { id } })
  revalidatePath("/clinicalos/studio")
  void logActivity({
    actorId: currentUser.userId,
    action: "workflow.delete",
    entityType: "workflow_definition",
    entityId: id,
    entityLabel: workflow.name,
  }).catch(console.error)

  return { success: true, message: "Workflow silindi." }
}

// ─── Form Builder ────────────────────────────────────────────────────────────

const FormDefinitionSchema = z.object({
  name: z.string().min(2, "İsim en az 2 karakter olmalıdır"),
  fields: z.string().min(2, "En az bir alan eklenmeli"),
})

export async function createFormDefinitionAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const currentUser = await verifySession()
  requirePermission(currentUser, "workflow:manage")

  const result = FormDefinitionSchema.safeParse({
    name: formData.get("name"),
    fields: formData.get("fields"),
  })
  if (!result.success) return { errors: result.error.flatten().fieldErrors }

  let fields: unknown
  try {
    fields = JSON.parse(result.data.fields)
  } catch {
    return { errors: { fields: ["Alan listesi geçersiz."] } }
  }

  // rootId, ilk versiyonun kendi id'sidir — insert öncesi bilinmediği için
  // iki adımda yazılıyor (create + rootId'yi kendi id'sine eşitleyen update).
  const created = await prisma.formDefinition.create({
    data: { rootId: "", name: result.data.name, fields: fields as object, version: 1, isLatest: true },
  })
  await prisma.formDefinition.update({ where: { id: created.id }, data: { rootId: created.id } })

  revalidatePath("/clinicalos/studio/forms")
  void logActivity({
    actorId: currentUser.userId,
    action: "form_definition.create",
    entityType: "form_definition",
    entityId: created.id,
    entityLabel: created.name,
  }).catch(console.error)

  return { success: true, message: "Form oluşturuldu." }
}

// Form satırları hiç yerinde değiştirilmez — düzenleme her zaman aynı rootId
// altında yeni bir versiyon satırı oluşturur, eskisini isLatest:false yapar.
// Workflow node'ları belirli bir versiyonun id'sine sabit referans verdiği için
// (formId), zaten yayında/kullanımda olan hiçbir workflow bu düzenlemeden
// etkilenmez — sadece dropdown'dan bilinçli olarak yeni versiyona geçirilirse.
export async function updateFormDefinitionAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const currentUser = await verifySession()
  requirePermission(currentUser, "workflow:manage")

  const rootId = formData.get("rootId") as string
  if (!rootId) return { message: "Form ID gerekli." }

  const result = FormDefinitionSchema.safeParse({
    name: formData.get("name"),
    fields: formData.get("fields"),
  })
  if (!result.success) return { errors: result.error.flatten().fieldErrors }

  let fields: unknown
  try {
    fields = JSON.parse(result.data.fields)
  } catch {
    return { errors: { fields: ["Alan listesi geçersiz."] } }
  }

  const current = await prisma.formDefinition.findFirst({ where: { rootId, isLatest: true } })
  if (!current) return { message: "Form bulunamadı." }

  const created = await prisma.$transaction(async (tx) => {
    await tx.formDefinition.update({ where: { id: current.id }, data: { isLatest: false } })
    return tx.formDefinition.create({
      data: {
        rootId,
        name: result.data.name,
        fields: fields as object,
        version: current.version + 1,
        isLatest: true,
      },
    })
  })

  revalidatePath("/clinicalos/studio/forms")
  revalidatePath("/clinicalos/studio", "layout")
  void logActivity({
    actorId: currentUser.userId,
    action: "form_definition.new_version",
    entityType: "form_definition",
    entityId: created.id,
    entityLabel: `${created.name} (v${created.version})`,
    metadata: { rootId, previousVersion: current.version, newVersion: created.version },
  }).catch(console.error)

  return {
    success: true,
    message: `Form v${created.version} olarak kaydedildi. Bu formu zaten kullanan workflow'lar eski sürümle çalışmaya devam eder.`,
  }
}

export async function getFormVersionHistoryAction(rootId: string) {
  const currentUser = await verifySession()
  requirePermission(currentUser, "workflow:manage")

  return prisma.formDefinition.findMany({ where: { rootId }, orderBy: { version: "desc" } })
}

export async function deleteFormDefinitionAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const currentUser = await verifySession()
  requirePermission(currentUser, "workflow:manage")

  const rootId = formData.get("rootId") as string
  if (!rootId) return { message: "Form ID gerekli." }

  const versions = await prisma.formDefinition.findMany({ where: { rootId } })
  if (versions.length === 0) return { message: "Form bulunamadı." }
  const latest = versions.find((v) => v.isLatest) ?? versions[0]

  // formId, JSON içindeki workflow node'larına gömülü olduğu için ilişkisel bir
  // FK yok — kullanım kontrolü tüm workflow'ların node grafiği taranarak yapılır.
  const versionIds = new Set(versions.map((v) => v.id))
  const workflows = await prisma.workflowDefinition.findMany({ select: { id: true, name: true, nodes: true } })
  const usedIn = workflows.filter((wf) => {
    const graph = wf.nodes as unknown as WorkflowGraph
    return graph?.nodes?.some((n) => n.type === "form" && n.formId && versionIds.has(n.formId))
  })
  if (usedIn.length > 0) {
    return {
      message: `Bu form (herhangi bir sürümü) ${usedIn.map((w) => w.name).join(", ")} workflow'unda kullanılıyor, silinemez.`,
    }
  }

  await prisma.formDefinition.deleteMany({ where: { rootId } })
  revalidatePath("/clinicalos/studio/forms")
  void logActivity({
    actorId: currentUser.userId,
    action: "form_definition.delete",
    entityType: "form_definition",
    entityId: rootId,
    entityLabel: latest.name,
    metadata: { versionsDeleted: versions.length },
  }).catch(console.error)

  return { success: true, message: "Form silindi." }
}

// ─── Rule (Decision node koşulları) ─────────────────────────────────────────

const RuleDefinitionSchema = z.object({
  name: z.string().min(2, "İsim en az 2 karakter olmalıdır"),
  field: z.string().min(1, "Alan adı gerekli"),
  operator: z.enum(["equals", "not_equals"]),
  value: z.string().min(1, "Değer gerekli"),
})

export async function createRuleDefinitionAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const currentUser = await verifySession()
  requirePermission(currentUser, "workflow:manage")

  const result = RuleDefinitionSchema.safeParse({
    name: formData.get("name"),
    field: formData.get("field"),
    operator: formData.get("operator"),
    value: formData.get("value"),
  })
  if (!result.success) return { errors: result.error.flatten().fieldErrors }

  const { name, field, operator, value } = result.data
  const parsedValue: string | number | boolean =
    value === "true" ? true : value === "false" ? false : isNaN(Number(value)) ? value : Number(value)

  const created = await prisma.ruleDefinition.create({
    data: { name, condition: { field, operator, value: parsedValue } },
  })

  revalidatePath("/clinicalos/studio", "layout")
  void logActivity({
    actorId: currentUser.userId,
    action: "rule_definition.create",
    entityType: "rule_definition",
    entityId: created.id,
    entityLabel: created.name,
  }).catch(console.error)

  return { success: true, message: "Kural oluşturuldu." }
}
