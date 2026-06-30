"use server"

import { prisma } from "@/lib/prisma"
import { verifySession, requirePermission } from "@/lib/dal"
import { z } from "zod/v4"
import { revalidatePath } from "next/cache"
import { logActivity } from "@/lib/db/activity"

const DepartmentSchema = z.object({
  name: z.string().min(2, "Departman adı en az 2 karakter olmalıdır"),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Geçerli bir renk kodu giriniz").optional(),
})

export type DepartmentActionState = {
  errors?: {
    name?: string[]
    description?: string[]
    color?: string[]
  }
  message?: string
  success?: boolean
}

export async function createDepartmentAction(
  _prev: DepartmentActionState,
  formData: FormData
): Promise<DepartmentActionState> {
  const currentUser = await verifySession()
  requirePermission(currentUser, "settings:manage")

  const raw = {
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || undefined,
    color: (formData.get("color") as string) || undefined,
  }

  const result = DepartmentSchema.safeParse(raw)
  if (!result.success) {
    return { errors: result.error.flatten().fieldErrors }
  }

  const { name, description, color } = result.data

  const exists = await prisma.department.findUnique({ where: { name } })
  if (exists) {
    return { errors: { name: ["Bu isimde bir departman zaten mevcut."] } }
  }

  const created = await prisma.department.create({
    data: { name, description, color: color ?? "#6366f1" },
  })

  revalidatePath("/settings/departments")
  revalidatePath("/settings/users")
  void logActivity({
    actorId: currentUser.userId,
    action: "department.create",
    entityType: "department",
    entityId: created.id,
    entityLabel: name,
  }).catch(console.error)
  return { success: true }
}

export async function updateDepartmentAction(
  _prev: DepartmentActionState,
  formData: FormData
): Promise<DepartmentActionState> {
  const currentUser = await verifySession()
  requirePermission(currentUser, "settings:manage")

  const id = formData.get("id") as string
  if (!id) return { message: "Departman ID gerekli." }

  const raw = {
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || undefined,
    color: (formData.get("color") as string) || undefined,
  }

  const result = DepartmentSchema.safeParse(raw)
  if (!result.success) {
    return { errors: result.error.flatten().fieldErrors }
  }

  const { name, description, color } = result.data

  const conflict = await prisma.department.findFirst({
    where: { name, NOT: { id } },
  })
  if (conflict) {
    return { errors: { name: ["Bu isimde bir departman zaten mevcut."] } }
  }

  await prisma.department.update({
    where: { id },
    data: { name, description, color: color ?? "#6366f1" },
  })

  revalidatePath("/settings/departments")
  revalidatePath("/settings/users")
  void logActivity({
    actorId: currentUser.userId,
    action: "department.update",
    entityType: "department",
    entityId: id,
    entityLabel: name,
  }).catch(console.error)
  return { success: true }
}

export async function deleteDepartmentAction(formData: FormData): Promise<void> {
  const currentUser = await verifySession()
  requirePermission(currentUser, "settings:manage")

  const id = formData.get("id") as string
  if (!id) return

  const dept = await prisma.department.findUnique({ where: { id }, select: { name: true } })
  await prisma.department.delete({ where: { id } })
  revalidatePath("/settings/departments")
  revalidatePath("/settings/users")
  void logActivity({
    actorId: currentUser.userId,
    action: "department.delete",
    entityType: "department",
    entityId: id,
    entityLabel: dept?.name,
  }).catch(console.error)
}
