"use server"

import { prisma } from "@/lib/prisma"
import { verifySession, requirePermission } from "@/lib/dal"
import { z } from "zod/v4"
import * as bcrypt from "bcryptjs"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { randomBytes } from "crypto"
import { sendSetupEmail } from "@/lib/mailer"
import { logActivity } from "@/lib/db/activity"

const CreateUserSchema = z.object({
  name: z.string().min(2, "İsim en az 2 karakter olmalıdır"),
  email: z.string().email("Geçerli bir e-posta adresi giriniz"),
  roleId: z.string().min(1, "Rol seçiniz"),
})

export type CreateUserState = {
  errors?: {
    name?: string[]
    email?: string[]
    roleId?: string[]
  }
  message?: string
  success?: boolean
}

export async function createUserAction(
  _prev: CreateUserState,
  formData: FormData
): Promise<CreateUserState> {
  const currentUser = await verifySession()
  requirePermission(currentUser, "user:create")

  const raw = Object.fromEntries(formData)
  const result = CreateUserSchema.safeParse(raw)

  if (!result.success) {
    return { errors: result.error.flatten().fieldErrors }
  }

  const { name, email, roleId } = result.data

  const targetRole = await prisma.role.findUnique({ where: { id: roleId } })
  if (!targetRole) return { message: "Geçersiz rol." }

  if (targetRole.name === "super_admin" && !currentUser.permissions.includes("settings:manage")) {
    return { message: "Süper admin rolü atamak için yetkiniz yok." }
  }

  const exists = await prisma.user.findUnique({ where: { email } })
  if (exists) {
    return { errors: { email: ["Bu e-posta adresi zaten kayıtlı."] } }
  }

  // Kullanıcı şifresini kendisi belirleyecek — geçici hash login'i engeller
  const tempHash = await bcrypt.hash(randomBytes(32).toString("hex"), 10)
  const setupToken = randomBytes(32).toString("hex")
  const setupTokenExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000) // 48 saat

  const departmentIds = formData.getAll("departmentIds").map(String).filter(Boolean)

  await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: tempHash,
      roleId,
      setupToken,
      setupTokenExpiry,
      departments: departmentIds.length > 0
        ? { connect: departmentIds.map((id) => ({ id })) }
        : undefined,
    },
  })

  revalidatePath("/settings/users")
  void logActivity({
    actorId: currentUser.userId,
    action: "user.create",
    entityType: "user",
    entityLabel: name,
    metadata: { email, role: targetRole.label },
  }).catch(console.error)

  const headersList = await headers()
  const host = headersList.get("host") ?? "localhost:8060"
  const protocol = host.startsWith("localhost") ? "http" : "https"
  const setupLink = `${protocol}://${host}/set-password?token=${setupToken}`

  if (process.env.NODE_ENV === "development") {
    console.log(`\n[DEV] Kurulum linki — ${email}\n${setupLink}\n`)
  }

  try {
    await sendSetupEmail({ to: email, name, roleName: targetRole.label, setupLink })
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    console.error("[mailer] setup email failed:", detail)
    // Kullanıcı oluşturuldu ama mail gönderilemedi — hata göster
    return {
      success: true,
      message: `Kullanıcı oluşturuldu fakat e-posta gönderilemedi: ${detail}`,
    }
  }

  return { success: true, message: "Kullanıcı oluşturuldu, davet maili gönderildi." }
}

const UpdateUserSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(2, "İsim en az 2 karakter olmalıdır"),
  email: z.string().email("Geçerli bir e-posta adresi giriniz"),
})

export type UpdateUserState = {
  errors?: {
    name?: string[]
    email?: string[]
  }
  message?: string
  success?: boolean
}

export async function updateUserAction(
  _prev: UpdateUserState,
  formData: FormData
): Promise<UpdateUserState> {
  const currentUser = await verifySession()
  requirePermission(currentUser, "user:update")

  const raw = {
    userId: formData.get("userId") as string,
    name: formData.get("name") as string,
    email: formData.get("email") as string,
  }

  const result = UpdateUserSchema.safeParse(raw)
  if (!result.success) {
    return { errors: result.error.flatten().fieldErrors }
  }

  const { userId, name, email } = result.data

  const target = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } })
  if (!target) return { message: "Kullanıcı bulunamadı." }

  if (target.role.name === "super_admin" && !currentUser.permissions.includes("settings:manage")) {
    return { message: "Bu kullanıcıyı düzenleme yetkiniz yok." }
  }

  const emailConflict = await prisma.user.findFirst({ where: { email, NOT: { id: userId } } })
  if (emailConflict) {
    return { errors: { email: ["Bu e-posta adresi başka bir kullanıcıya ait."] } }
  }

  const departmentIds = formData.getAll("departmentIds").map(String).filter(Boolean)

  await prisma.user.update({
    where: { id: userId },
    data: {
      name,
      email,
      departments: { set: departmentIds.map((id) => ({ id })) },
    },
  })

  revalidatePath("/settings/users")
  void logActivity({
    actorId: currentUser.userId,
    action: "user.update",
    entityType: "user",
    entityId: userId,
    entityLabel: name,
    metadata: { email },
  }).catch(console.error)
  return { success: true }
}

const UpdateRoleSchema = z.object({
  userId: z.string().min(1),
  roleId: z.string().min(1),
})

export type UpdateRoleState = {
  message?: string
  success?: boolean
}

export async function updateUserRoleAction(
  _prev: UpdateRoleState,
  formData: FormData
): Promise<UpdateRoleState> {
  const currentUser = await verifySession()
  requirePermission(currentUser, "user:update")

  const raw = Object.fromEntries(formData)
  const result = UpdateRoleSchema.safeParse(raw)
  if (!result.success) return { message: "Geçersiz veriler." }

  const { userId, roleId } = result.data

  if (userId === currentUser.userId) {
    return { message: "Kendi rolünüzü değiştiremezsiniz." }
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  })
  if (!target) return { message: "Kullanıcı bulunamadı." }

  const targetRole = await prisma.role.findUnique({ where: { id: roleId } })
  if (!targetRole) return { message: "Geçersiz rol." }

  if (target.role.name === "super_admin" && !currentUser.permissions.includes("settings:manage")) {
    return { message: "Süper admin rolünü değiştirmek için yetkiniz yok." }
  }
  if (targetRole.name === "super_admin" && !currentUser.permissions.includes("settings:manage")) {
    return { message: "Süper admin rolü atamak için yetkiniz yok." }
  }

  await prisma.user.update({ where: { id: userId }, data: { roleId } })
  revalidatePath("/settings/users")
  void logActivity({
    actorId: currentUser.userId,
    action: "user.role_change",
    entityType: "user",
    entityId: userId,
    entityLabel: target.name,
    metadata: { from: target.role.label, to: targetRole.label },
  }).catch(console.error)
  return { success: true, message: "Rol güncellendi." }
}

export type ResendInviteState = {
  message?: string
  success?: boolean
  setupLink?: string
}

export async function resendInviteAction(
  _prev: ResendInviteState,
  formData: FormData
): Promise<ResendInviteState> {
  const currentUser = await verifySession()
  requirePermission(currentUser, "user:create")

  const userId = formData.get("userId") as string
  if (!userId) return { message: "Kullanıcı ID gerekli." }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  })
  if (!target) return { message: "Kullanıcı bulunamadı." }
  if (!target.setupToken) return { message: "Bu kullanıcı zaten hesabını kurmuş." }

  const setupToken = randomBytes(32).toString("hex")
  const setupTokenExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000)

  await prisma.user.update({
    where: { id: userId },
    data: { setupToken, setupTokenExpiry },
  })

  const headersList = await headers()
  const host = headersList.get("host") ?? "localhost:8060"
  const protocol = host.startsWith("localhost") ? "http" : "https"
  const setupLink = `${protocol}://${host}/set-password?token=${setupToken}`

  if (process.env.NODE_ENV === "development") {
    console.log(`\n[DEV] Kurulum linki — ${target.email}\n${setupLink}\n`)
  }

  try {
    await sendSetupEmail({
      to: target.email,
      name: target.name,
      roleName: target.role.label,
      setupLink,
    })
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    console.error("[mailer] resend invite failed:", detail)
    return {
      success: false,
      message: `E-posta gönderilemedi: ${detail}`,
      ...(process.env.NODE_ENV === "development" && { setupLink }),
    }
  }

  void logActivity({
    actorId: currentUser.userId,
    action: "user.invite_resent",
    entityType: "user",
    entityId: userId,
    entityLabel: target.name,
    metadata: { email: target.email },
  }).catch(console.error)

  return {
    success: true,
    message: "Davet e-postası yeniden gönderildi.",
    ...(process.env.NODE_ENV === "development" && { setupLink }),
  }
}

export async function deleteUserFormAction(formData: FormData): Promise<void> {
  await deleteUserAction({}, formData)
}

export async function deleteUserAction(
  _prev: UpdateRoleState,
  formData: FormData
): Promise<UpdateRoleState> {
  const currentUser = await verifySession()
  requirePermission(currentUser, "user:delete")

  const userId = formData.get("userId") as string
  if (!userId) return { message: "Kullanıcı ID gerekli." }

  if (userId === currentUser.userId) return { message: "Kendinizi silemezsiniz." }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  })
  if (!target) return { message: "Kullanıcı bulunamadı." }
  if (target.role.name === "super_admin") return { message: "Süper admin hesabı silinemez." }

  await prisma.user.delete({ where: { id: userId } })
  revalidatePath("/settings/users")
  void logActivity({
    actorId: currentUser.userId,
    action: "user.delete",
    entityType: "user",
    entityId: userId,
    entityLabel: target.name,
    metadata: { email: target.email, role: target.role.label },
  }).catch(console.error)
  return { success: true, message: "Kullanıcı silindi." }
}
