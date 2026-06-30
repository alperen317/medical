import "server-only"
import { prisma } from "@/lib/prisma"
import { ALL_PERMISSIONS, type Permission } from "@/lib/permissions"

type SystemRoleSeed = {
  id: string
  name: string
  label: string
  permissions: Permission[]
}

/**
 * İlk kurulumda oluşturulan varsayılan sistem rolleri.
 * Bu liste rollerin tek doğruluk kaynağıdır (migration ile aynı izin setleri).
 */
export const DEFAULT_SYSTEM_ROLES: SystemRoleSeed[] = [
  {
    id: "role_super_admin",
    name: "super_admin",
    label: "Süper Admin",
    permissions: [...ALL_PERMISSIONS],
  },
  {
    id: "role_admin",
    name: "admin",
    label: "Yönetici",
    permissions: [
      "patient:read", "patient:create", "patient:update", "patient:delete",
      "timeline:read", "timeline:create", "timeline:delete",
      "diagnosis:read", "diagnosis:create", "diagnosis:update",
      "prescription:read", "prescription:create", "prescription:update",
      "document:read", "document:upload",
      "user:read", "user:create", "user:update",
      "settings:manage",
    ],
  },
  {
    id: "role_doctor",
    name: "doctor",
    label: "Hekim",
    permissions: [
      "patient:read", "patient:create", "patient:update",
      "timeline:read", "timeline:create",
      "diagnosis:read", "diagnosis:create", "diagnosis:update",
      "prescription:read", "prescription:create", "prescription:update",
      "document:read", "document:upload",
    ],
  },
  {
    id: "role_nurse",
    name: "nurse",
    label: "Hemşire",
    permissions: [
      "patient:read", "patient:update",
      "timeline:read", "timeline:create",
      "diagnosis:read",
      "prescription:read",
      "document:read", "document:upload",
    ],
  },
  {
    id: "role_receptionist",
    name: "receptionist",
    label: "Resepsiyonist",
    permissions: [
      "patient:read", "patient:create",
      "timeline:read",
      "document:read",
    ],
  },
]

/**
 * Varsayılan sistem rollerini oluşturur (yoksa). İlk kurulumda çağrılır.
 * Mevcut roller — admin tarafından özelleştirilmiş olabileceğinden — değiştirilmez.
 */
export async function ensureSystemRoles() {
  for (const role of DEFAULT_SYSTEM_ROLES) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: {
        id: role.id,
        name: role.name,
        label: role.label,
        permissions: role.permissions,
        isSystem: true,
      },
    })
  }
}

export async function getRoles() {
  return prisma.role.findMany({
    orderBy: [{ isSystem: "desc" }, { createdAt: "asc" }],
    include: {
      _count: { select: { users: true } },
    },
  })
}

export type RoleWithCount = Awaited<ReturnType<typeof getRoles>>[number]

export async function getRoleById(id: string) {
  return prisma.role.findUnique({ where: { id } })
}
