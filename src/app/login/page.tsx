import { redirect } from "next/navigation"
import { getUserCount } from "@/lib/db/users"
import LoginForm from "./_components/login-form"

// Canlı kullanıcı sayısına bağlı — build sırasında prerender edilmesin (DB gerektirir).
export const dynamic = "force-dynamic"

export default async function LoginPage() {
  // Sistem ilk kez çalıştırılıyorsa (hiç kullanıcı yok) kuruluma yönlendir:
  // ilk kişi super admin olarak şifresini oluşturur.
  const count = await getUserCount()
  if (count === 0) redirect("/setup")

  return <LoginForm />
}
