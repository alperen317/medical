"use server"

import { prisma } from "@/lib/prisma"
import { z } from "zod/v4"
import * as bcrypt from "bcryptjs"
import { redirect } from "next/navigation"

const Schema = z
  .object({
    token: z.string().min(1),
    mode: z.string().optional(),
    password: z.string().min(8, "Şifre en az 8 karakter olmalıdır"),
    confirmPassword: z.string(),
  })
  .check((ctx) => {
    if (ctx.value.password !== ctx.value.confirmPassword) {
      ctx.issues.push({
        code: "custom",
        path: ["confirmPassword"],
        message: "Şifreler eşleşmiyor",
        input: ctx.value,
      })
    }
  })

export type SetPasswordState = {
  errors?: {
    password?: string[]
    confirmPassword?: string[]
  }
  message?: string
  success?: boolean
}

export async function setPasswordAction(
  _prev: SetPasswordState,
  formData: FormData
): Promise<SetPasswordState> {
  const raw = Object.fromEntries(formData)
  const result = Schema.safeParse(raw)

  if (!result.success) {
    return { errors: result.error.flatten().fieldErrors }
  }

  const { token, mode, password } = result.data

  const user = await prisma.user.findFirst({
    where: {
      setupToken: token,
      setupTokenExpiry: { gt: new Date() },
    },
  })

  if (!user) {
    return { message: "Bu link geçersiz veya süresi dolmuş. Sistem yöneticinizle iletişime geçin." }
  }

  const passwordHash = await bcrypt.hash(password, 10)
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, setupToken: null, setupTokenExpiry: null },
  })

  redirect(mode === "reset" ? "/login?reset=1" : "/login?activated=1")
}
