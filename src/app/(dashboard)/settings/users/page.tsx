import { Header } from "@/components/layout/header"
import { verifySession, requirePermission } from "@/lib/dal"
import { getUsers } from "@/lib/db/users"
import { getRoles } from "@/lib/db/roles"
import { getDepartments } from "@/lib/db/departments"
import { UsersClient } from "./_components/users-client"

export default async function UsersPage() {
  const currentUser = await verifySession()
  requirePermission(currentUser, "user:read")

  const [users, roles, departments] = await Promise.all([getUsers(), getRoles(), getDepartments()])

  return (
    <div>
      <Header
        title="Kullanıcı Yönetimi"
        subtitle={`${users.length} kayıtlı kullanıcı`}
      />
      <div className="p-6">
        <UsersClient
          users={users}
          roles={roles}
          departments={departments}
          currentUserId={currentUser.userId}
          currentUserPermissions={currentUser.permissions}
        />
      </div>
    </div>
  )
}
