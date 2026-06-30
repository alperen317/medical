"use client"

import { useActionState } from "react"
import { Mail, Loader2, CheckCircle2, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { forgotPasswordAction } from "@/lib/actions/forgot-password"

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, {})

  if (state.success) {
    return (
      <Card className="border-slate-700/50 bg-slate-800/50 backdrop-blur-sm">
        <CardContent className="pt-6 pb-6 text-center space-y-4">
          <div className="flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
              <CheckCircle2 className="h-6 w-6 text-green-400" />
            </div>
          </div>
          <div>
            <p className="text-white font-medium">Mail Gönderildi</p>
            <p className="text-sm text-slate-400 mt-1">{state.message}</p>
          </div>
          <p className="text-xs text-slate-500">
            Spam klasörünüzü de kontrol etmeyi unutmayın.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Giriş sayfasına dön
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-slate-700/50 bg-slate-800/50 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg text-white">Şifremi Unuttum</CardTitle>
        <CardDescription className="text-slate-400">
          E-posta adresinizi girin, şifre sıfırlama linki gönderelim.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          {state.message && !state.success && (
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
                autoFocus
                className="pl-9 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus-visible:ring-blue-500"
              />
            </div>
            {state.errors?.email && (
              <p className="text-xs text-red-400">{state.errors.email[0]}</p>
            )}
          </div>

          <Button
            type="submit"
            disabled={pending}
            className="w-full bg-primary hover:bg-primary/90"
          >
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Gönderiliyor...
              </>
            ) : (
              "Sıfırlama Linki Gönder"
            )}
          </Button>

          <div className="text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-300 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Geri dön
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
