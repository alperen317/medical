"use server"

import { prisma } from "@/lib/prisma"
import { z } from "zod/v4"
import { randomBytes } from "crypto"
import { headers } from "next/headers"
import { sendPasswordResetEmail } from "@/lib/mailer"

const Schema = z.object({
  email: z.string().email("Geçerli bir e-posta adresi giriniz"),
})

export type ForgotPasswordState = {
  errors?: { email?: string[] }
  message?: string
  success?: boolean
}

export async function forgotPasswordAction(
  _prev: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const raw = Object.fromEntries(formData)
  const result = Schema.safeParse(raw)

  if (!result.success) {
    return { errors: result.error.flatten().fieldErrors }
  }

  const { email } = result.data
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true } })

  // Email enumeration'ı önlemek için kullanıcı bulunsun ya da bulunmasın aynı yanıt
  if (user) {
    const resetToken = randomBytes(32).toString("hex")
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000) // 1 saat

    await prisma.user.update({
      where: { id: user.id },
      data: { setupToken: resetToken, setupTokenExpiry: resetTokenExpiry },
    })

    const headersList = await headers()
    const host = headersList.get("host") ?? "localhost:8060"
    const protocol = host.startsWith("localhost") ? "http" : "https"
    const resetLink = `${protocol}://${host}/set-password?token=${resetToken}&mode=reset`

    sendPasswordResetEmail({ to: email, name: user.name, resetLink }).catch(
      (err) => console.error("[mailer] password reset email failed:", err)
    )
  }

  return {
    success: true,
    message: "Eğer bu e-posta sistemde kayıtlıysa, şifre sıfırlama linki gönderildi.",
  }
}
