import { redirect } from "next/navigation"
import { getUserCount } from "@/lib/db/users"
import { SetupForm } from "./setup-form"

// Canlı kullanıcı sayısına bağlı — build sırasında prerender edilmesin (DB gerektirir).
export const dynamic = "force-dynamic"

export default async function SetupPage() {
  const count = await getUserCount()
  if (count > 0) redirect("/login")

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-8 p-8">
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <svg
                className="h-7 w-7 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold">Yeditepe Hasta Yönetim Paneli — Kurulum</h1>
          <p className="mt-2 text-muted-foreground text-sm">
            İlk süper admin hesabını oluşturun. Sistem kurulduktan sonra bu sayfa erişilemez olacaktır.
          </p>
        </div>

        <SetupForm />
      </div>
    </div>
  )
}
