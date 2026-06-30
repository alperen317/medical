"use client"

import { useActionState, useState } from "react"
import { Lock, Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { setPasswordAction } from "@/lib/actions/set-password"

export function SetPasswordForm({
  token,
  userName,
  mode,
}: {
  token: string
  userName: string
  mode?: string
}) {
  const [state, action, pending] = useActionState(setPasswordAction, {})
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const isReset = mode === "reset"

  return (
    <Card className="border-slate-700/50 bg-slate-800/50 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg text-white">
          {isReset ? "Yeni Şifre Belirle" : "Hesabınızı Aktif Edin"}
        </CardTitle>
        <CardDescription className="text-slate-400">
          {isReset
            ? `Merhaba ${userName}, yeni şifrenizi belirleyin.`
            : `Merhaba ${userName}, hesabınızı aktif etmek için bir şifre belirleyin.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <input type="hidden" name="token" value={token} />
          {mode && <input type="hidden" name="mode" value={mode} />}

          {state.message && (
            <div className="rounded-md bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-400">
              {state.message}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Şifre</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                name="password"
                type={showPw ? "text" : "password"}
                placeholder="En az 8 karakter"
                autoComplete="new-password"
                className="pl-9 pr-9 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus-visible:ring-blue-500"
              />
              <button
                type="button"
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-300 transition-colors"
                onClick={() => setShowPw((v) => !v)}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {state.errors?.password && (
              <p className="text-xs text-red-400">{state.errors.password[0]}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Şifre Tekrar</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                name="confirmPassword"
                type={showConfirm ? "text" : "password"}
                placeholder="Şifrenizi tekrar girin"
                autoComplete="new-password"
                className="pl-9 pr-9 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus-visible:ring-blue-500"
              />
              <button
                type="button"
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-300 transition-colors"
                onClick={() => setShowConfirm((v) => !v)}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {state.errors?.confirmPassword && (
              <p className="text-xs text-red-400">{state.errors.confirmPassword[0]}</p>
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
                Kaydediliyor...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {isReset ? "Şifremi Güncelle" : "Şifremi Kaydet ve Giriş Yap"}
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
