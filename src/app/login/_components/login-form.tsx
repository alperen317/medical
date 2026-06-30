"use client"

import { useActionState, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Eye, EyeOff, Lock, Mail, Loader2, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { loginAction } from "@/lib/actions/auth"

export default function LoginForm() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}

function LoginContent() {
  const [showPassword, setShowPassword] = useState(false)
  const [state, action, pending] = useActionState(loginAction, {})
  const searchParams = useSearchParams()
  const activated = searchParams.get("activated") === "1"
  const reset = searchParams.get("reset") === "1"

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

        <Card className="border-slate-700/50 bg-slate-800/50 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-white">Giriş Yap</CardTitle>
            <CardDescription className="text-slate-400">
              Sisteme erişmek için kurumsal hesabınızı kullanın
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={action} className="space-y-4">
              {activated && (
                <div className="flex items-center gap-2 rounded-md bg-green-500/10 border border-green-500/20 px-3 py-2 text-sm text-green-400">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Hesabınız aktif edildi. Giriş yapabilirsiniz.
                </div>
              )}
              {reset && (
                <div className="flex items-center gap-2 rounded-md bg-green-500/10 border border-green-500/20 px-3 py-2 text-sm text-green-400">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Şifreniz güncellendi. Yeni şifrenizle giriş yapabilirsiniz.
                </div>
              )}
              {state?.message && (
                <div className="rounded-md bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-400">
                  {state.message}
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-slate-300">
                  E-posta
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="adınız@klinik.com"
                    autoComplete="email"
                    className="pl-9 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus-visible:ring-primary"
                  />
                </div>
                {state?.errors?.email && (
                  <p className="text-xs text-red-400">{state.errors.email[0]}</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-sm font-medium text-slate-300">
                    Şifre
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Şifremi unuttum
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="pl-9 pr-9 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus-visible:ring-primary"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-300 transition-colors"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {state?.errors?.password && (
                  <p className="text-xs text-red-400">{state.errors.password[0]}</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={pending}
                className="w-full mt-2 bg-primary hover:bg-primary/90"
              >
                {pending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Giriş yapılıyor...
                  </>
                ) : (
                  "Giriş Yap"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-500">
          Bu sistem yalnızca yetkili klinik personeline açıktır.
          <br />
          Erişim sorunlarınız için sistem yöneticinizle iletişime geçin.
        </p>
      </div>
    </div>
  )
}
