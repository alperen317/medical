import "server-only"
import { cache } from "react"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import type { Permission } from "@/lib/permissions"

export type SessionUser = {
  userId: string
  roleId: string
  roleName: string
  permissions: string[]
  name: string
  email: string
}

export const verifySession = cache(async (): Promise<SessionUser> => {
  const session = await getSession()
  if (!session?.userId) redirect("/login")
  return {
    userId: session.userId,
    roleId: session.roleId,
    roleName: session.roleName,
    permissions: session.permissions ?? [],
    name: session.name,
    email: session.email,
  }
})

export const getOptionalSession = cache(async (): Promise<SessionUser | null> => {
  const session = await getSession()
  if (!session?.userId) return null
  return {
    userId: session.userId,
    roleId: session.roleId,
    roleName: session.roleName,
    permissions: session.permissions ?? [],
    name: session.name,
    email: session.email,
  }
})

export function requireRole(user: SessionUser, ...roleNames: string[]) {
  if (!roleNames.includes(user.roleName)) redirect("/dashboard")
}

export function requirePermission(user: SessionUser, permission: Permission) {
  if (!user.permissions.includes(permission)) redirect("/dashboard")
}
