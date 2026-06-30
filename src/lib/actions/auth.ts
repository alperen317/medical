"use server"

import { redirect } from "next/navigation"
import { z } from "zod/v4"
import * as bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { createSession, deleteSession } from "@/lib/session"
import { getOptionalSession } from "@/lib/dal"
import { logActivity } from "@/lib/db/activity"

const loginSchema = z.object({
  email: z.email("Geçerli bir e-posta girin"),
  password: z.string().min(1, "Şifre zorunludur"),
})

export type LoginFormState = {
  errors?: { email?: string[]; password?: string[] }
  message?: string
}

export async function loginAction(
  _prev: LoginFormState,
  formData: FormData
): Promise<LoginFormState> {
  const validated = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors }
  }

  const { email, password } = validated.data

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      role: { select: { id: true, name: true, permissions: true } },
    },
  })

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return { message: "E-posta veya şifre hatalı" }
  }

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
    action: "auth.login",
    entityType: "auth",
    entityLabel: user.name,
  }).catch(console.error)

  redirect("/dashboard")
}

export async function logoutAction() {
  const session = await getOptionalSession()
  await deleteSession()
  if (session) {
    void logActivity({
      actorId: session.userId,
      action: "auth.logout",
      entityType: "auth",
      entityLabel: session.name,
    }).catch(console.error)
  }
  redirect("/login")
}
