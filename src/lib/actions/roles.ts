"use server"

import { prisma } from "@/lib/prisma"
import { verifySession, requirePermission } from "@/lib/dal"
import { z } from "zod/v4"
import { revalidatePath } from "next/cache"
import { ALL_PERMISSIONS } from "@/lib/permissions"
import { logActivity } from "@/lib/db/activity"

const RoleSchema = z.object({
  name: z
    .string()
    .min(2, "İsim en az 2 karakter olmalıdır")
    .regex(/^[a-z_]+$/, "Sadece küçük harf ve alt çizgi kullanılabilir"),
  label: z.string().min(2, "Etiket en az 2 karakter olmalıdır"),
})

export type RoleFormState = {
  errors?: { name?: string[]; label?: string[] }
  message?: string
  success?: boolean
}

export async function createRoleAction(
  _prev: RoleFormState,
  formData: FormData
): Promise<RoleFormState> {
  const currentUser = await verifySession()
  requirePermission(currentUser, "settings:manage")

  const raw = { name: formData.get("name"), label: formData.get("label") }
  const result = RoleSchema.safeParse(raw)
  if (!result.success) return { errors: result.error.flatten().fieldErrors }

  const { name, label } = result.data

  const permissions = ALL_PERMISSIONS.filter((p) => formData.get(`perm_${p}`) === "on")

  const exists = await prisma.role.findUnique({ where: { name } })
  if (exists) return { errors: { name: ["Bu rol adı zaten mevcut."] } }

  const created = await prisma.role.create({ data: { name, label, permissions, isSystem: false } })
  revalidatePath("/settings/roles")
  void logActivity({
    actorId: currentUser.userId,
    action: "role.create",
    entityType: "role",
    entityId: created.id,
    entityLabel: label,
  }).catch(console.error)
  return { success: true, message: "Rol oluşturuldu." }
}

export type UpdatePermissionsState = {
  message?: string
  success?: boolean
}

export async function updateRolePermissionsAction(
  _prev: UpdatePermissionsState,
  formData: FormData
): Promise<UpdatePermissionsState> {
  const currentUser = await verifySession()
  requirePermission(currentUser, "settings:manage")

  const roleId = formData.get("roleId") as string
  if (!roleId) return { message: "Rol ID gerekli." }

  const role = await prisma.role.findUnique({ where: { id: roleId } })
  if (!role) return { message: "Rol bulunamadı." }

  if (role.name === "super_admin") {
    return { message: "Süper admin rolünün izinleri değiştirilemez." }
  }

  const permissions = ALL_PERMISSIONS.filter((p) => formData.get(`perm_${p}`) === "on")

  await prisma.role.update({ where: { id: roleId }, data: { permissions } })
  revalidatePath("/settings/roles")
  void logActivity({
    actorId: currentUser.userId,
    action: "role.update_permissions",
    entityType: "role",
    entityId: roleId,
    entityLabel: role.label,
  }).catch(console.error)
  return { success: true, message: "İzinler güncellendi." }
}

export async function updateRoleLabelAction(
  _prev: UpdatePermissionsState,
  formData: FormData
): Promise<UpdatePermissionsState> {
  const currentUser = await verifySession()
  requirePermission(currentUser, "settings:manage")

  const roleId = formData.get("roleId") as string
  const label = (formData.get("label") as string)?.trim()
  if (!roleId || !label || label.length < 2) return { message: "Geçersiz veriler." }

  const role = await prisma.role.findUnique({ where: { id: roleId } })
  if (!role) return { message: "Rol bulunamadı." }

  await prisma.role.update({ where: { id: roleId }, data: { label } })
  revalidatePath("/settings/roles")
  void logActivity({
    actorId: currentUser.userId,
    action: "role.update_label",
    entityType: "role",
    entityId: roleId,
    entityLabel: label,
    metadata: { from: role.label, to: label },
  }).catch(console.error)
  return { success: true, message: "Rol adı güncellendi." }
}

export async function deleteRoleAction(
  _prev: UpdatePermissionsState,
  formData: FormData
): Promise<UpdatePermissionsState> {
  const currentUser = await verifySession()
  requirePermission(currentUser, "settings:manage")

  const roleId = formData.get("roleId") as string
  if (!roleId) return { message: "Rol ID gerekli." }

  const role = await prisma.role.findUnique({
    where: { id: roleId },
    include: { _count: { select: { users: true } } },
  })
  if (!role) return { message: "Rol bulunamadı." }
  if (role.isSystem) return { message: "Sistem rolleri silinemez." }
  if (role._count.users > 0) {
    return { message: `Bu role atanmış ${role._count.users} kullanıcı var. Önce kullanıcıları başka bir role aktarın.` }
  }

  await prisma.role.delete({ where: { id: roleId } })
  revalidatePath("/settings/roles")
  void logActivity({
    actorId: currentUser.userId,
    action: "role.delete",
    entityType: "role",
    entityId: roleId,
    entityLabel: role.label,
  }).catch(console.error)
  return { success: true, message: "Rol silindi." }
}
