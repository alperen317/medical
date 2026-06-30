import { Header } from "@/components/layout/header"
import { verifySession, requirePermission } from "@/lib/dal"
import { getRoles } from "@/lib/db/roles"
import { RolesClient } from "./_components/roles-client"

export default async function RolesPage() {
  const currentUser = await verifySession()
  requirePermission(currentUser, "settings:manage")

  const roles = await getRoles()

  return (
    <div>
      <Header
        title="Roller & Yetkiler"
        subtitle="Rol izinlerini düzenleyin, yeni rol oluşturun"
      />
      <div className="p-6">
        <RolesClient roles={roles} />
      </div>
    </div>
  )
}
