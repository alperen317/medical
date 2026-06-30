"use client"

import { useActionState, useState } from "react"
import { Loader2, Eye, EyeOff, Lock, Mail, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { setupAction } from "@/lib/actions/setup"

export function SetupForm() {
  const [showPassword, setShowPassword] = useState(false)
  const [state, action, pending] = useActionState(setupAction, {})

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle>Süper Admin Hesabı</CardTitle>
        <CardDescription>
          Bu hesap tüm sistem yetkilerine sahip olacaktır.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          {state?.message && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {state.message}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">Ad Soyad</label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="name"
                name="name"
                placeholder="Adınız Soyadınız"
                autoComplete="name"
                className="pl-9"
              />
            </div>
            {state?.errors?.name && (
              <p className="text-xs text-destructive">{state.errors.name[0]}</p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">E-posta</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="admin@klinik.com"
                autoComplete="email"
                className="pl-9"
              />
            </div>
            {state?.errors?.email && (
              <p className="text-xs text-destructive">{state.errors.email[0]}</p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">Şifre</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="En az 8 karakter"
                autoComplete="new-password"
                className="pl-9 pr-9"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {state?.errors?.password && (
              <p className="text-xs text-destructive">{state.errors.password[0]}</p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="text-sm font-medium">Şifre Tekrar</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type={showPassword ? "text" : "password"}
                placeholder="Şifreyi tekrar giriniz"
                autoComplete="new-password"
                className="pl-9"
              />
            </div>
            {state?.errors?.confirmPassword && (
              <p className="text-xs text-destructive">{state.errors.confirmPassword[0]}</p>
            )}
          </div>

          <Button type="submit" disabled={pending} className="w-full mt-2">
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Hesap oluşturuluyor...
              </>
            ) : (
              "Kurulumu Tamamla"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
