"use server"

import { prisma } from "@/lib/prisma"
import { createSession } from "@/lib/session"
import { ensureSystemRoles } from "@/lib/db/roles"
import { logActivity } from "@/lib/db/activity"
import { redirect } from "next/navigation"
import { z } from "zod/v4"
import * as bcrypt from "bcryptjs"

const SetupSchema = z.object({
  name: z.string().min(2, "İsim en az 2 karakter olmalıdır"),
  email: z.string().email("Geçerli bir e-posta adresi giriniz"),
  password: z.string().min(8, "Şifre en az 8 karakter olmalıdır"),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Şifreler eşleşmiyor",
  path: ["confirmPassword"],
})

export type SetupState = {
  errors?: {
    name?: string[]
    email?: string[]
    password?: string[]
    confirmPassword?: string[]
  }
  message?: string
}

export async function setupAction(
  _prev: SetupState,
  formData: FormData
): Promise<SetupState> {
  const count = await prisma.user.count()
  if (count > 0) redirect("/login")

  const raw = Object.fromEntries(formData)
  const result = SetupSchema.safeParse(raw)
  if (!result.success) {
    return { errors: result.error.flatten().fieldErrors }
  }

  const { name, email, password } = result.data

  // İlk kurulum: varsayılan sistem rollerini oluştur (yoksa)
  await ensureSystemRoles()

  const superAdminRole = await prisma.role.findUnique({ where: { name: "super_admin" } })
  if (!superAdminRole) {
    return { message: "Sistem rolleri oluşturulamadı. Lütfen veritabanı bağlantısını kontrol edin." }
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: { name, email, passwordHash, roleId: superAdminRole.id },
    include: { role: { select: { id: true, name: true, permissions: true } } },
  })

  await createSession({
    userId: user.id,
    roleId: user.role.id,
    roleName: user.role.name,
    permissions: user.role.permissions,
    name: user.name,
    email: user.email,
  })

  void logActivity({
    actorId: user.id,
    action: "setup.super_admin.create",
    entityType: "user",
    entityId: user.id,
    entityLabel: user.name,
    metadata: { email: user.email, role: user.role.name },
  }).catch(console.error)

  redirect("/dashboard")
}
