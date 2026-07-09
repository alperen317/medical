import { Header } from "@/components/layout/header"
import { verifySession, requirePermission } from "@/lib/dal"
import { getWorkflowDefinitions } from "@/lib/db/workflow-studio"
import { StudioClient } from "./_components/studio-client"

export default async function WorkflowStudioPage() {
  const currentUser = await verifySession()
  requirePermission(currentUser, "workflow:manage")

  const workflows = await getWorkflowDefinitions()

  return (
    <div>
      <Header
        title="Workflow Studio"
        subtitle="Metadata ile tanımlanan klinik akışları oluşturun ve düzenleyin"
      />
      <div className="p-6">
        <StudioClient workflows={workflows} />
      </div>
    </div>
  )
}
