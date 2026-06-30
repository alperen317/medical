import Image from "next/image"
import { ForgotPasswordForm } from "./_components/forgot-password-form"

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 p-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <Image src="/logo.svg" alt="Yeditepe Hasta Yönetim Paneli" height={48} width={218} className="w-auto" />
          <p className="text-sm text-slate-400">Hasta Yönetim Paneli</p>
        </div>

        <ForgotPasswordForm />
      </div>
    </div>
  )
}
