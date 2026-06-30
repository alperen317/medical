import { Header } from "@/components/layout/header"
import { verifySession, requirePermission } from "@/lib/dal"
import { getDepartments } from "@/lib/db/departments"
import { DepartmentsClient } from "./_components/departments-client"

export default async function DepartmentsPage() {
  const currentUser = await verifySession()
  requirePermission(currentUser, "settings:manage")

  const departments = await getDepartments()

  return (
    <div>
      <Header
        title="Departman Yönetimi"
        subtitle={`${departments.length} departman`}
      />
      <div className="p-6">
        <DepartmentsClient departments={departments} />
      </div>
    </div>
  )
}
