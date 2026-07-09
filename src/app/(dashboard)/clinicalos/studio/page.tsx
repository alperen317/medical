import { Header } from "@/components/layout/header"
import { verifySession, requirePermission } from "@/lib/dal"
import { getWorkflowDefinitions } from "@/lib/db/workflow-studio"
import { getServerT } from "@/lib/i18n/server"
import { StudioClient } from "./_components/studio-client"

export default async function WorkflowStudioPage() {
  const currentUser = await verifySession()
  requirePermission(currentUser, "workflow:manage")
  const t = await getServerT()

  const workflows = await getWorkflowDefinitions()

  return (
    <div>
      <Header
        title={t("page.workflow_studio.title")}
        subtitle={t("page.workflow_studio.subtitle")}
      />
      <div className="p-6">
        <StudioClient workflows={workflows} />
      </div>
    </div>
  )
}
