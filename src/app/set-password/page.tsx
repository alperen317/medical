import Image from "next/image"
import { LinkIcon } from "lucide-react"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { SetPasswordForm } from "./_components/set-password-form"

// Token'a göre canlı DB sorgusu yapar — build sırasında prerender edilmesin.
export const dynamic = "force-dynamic"

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; mode?: string }>
}) {
  const { token, mode } = await searchParams

  const user = token
    ? await prisma.user.findFirst({
        where: { setupToken: token, setupTokenExpiry: { gt: new Date() } },
        select: { name: true },
      })
    : null

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 p-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <Image src="/logo.svg" alt="Yeditepe Hasta Yönetim Paneli AI Projesi" height={48} width={218} className="w-auto" />
          <p className="text-sm text-slate-400">Hasta Yönetim Paneli AI Projesi</p>
        </div>

        {!token || !user ? (
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 backdrop-blur-sm p-6 text-center space-y-3">
            <div className="flex justify-center">
              <LinkIcon className="h-8 w-8 text-slate-500" />
            </div>
            <p className="text-white font-medium">Bu link geçersiz veya süresi dolmuş</p>
            <p className="text-sm text-slate-400">
              Şifre belirleme linkleri 48 saat geçerlidir. Sistem yöneticinizden yeni bir davet
              linki talep edin.
            </p>
            <Link
              href="/login"
              className="inline-block text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              Giriş sayfasına dön
            </Link>
          </div>
        ) : (
          <SetPasswordForm token={token} userName={user.name} mode={mode} />
        )}
      </div>
    </div>
  )
}
