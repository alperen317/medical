import { Header } from "@/components/layout/header"
import { verifySession, requirePermission } from "@/lib/dal"
import { getWorkflowInstances, getPublishedWorkflowDefinitions } from "@/lib/db/clinicalos-intake"
import { getServerT } from "@/lib/i18n/server"
import { IntakeClient } from "./_components/intake-client"

export default async function PatientIntakePage() {
  const currentUser = await verifySession()
  requirePermission(currentUser, "intake:execute")
  const t = await getServerT()

  const [instances, workflows] = await Promise.all([
    getWorkflowInstances(),
    getPublishedWorkflowDefinitions(),
  ])

  return (
    <div>
      <Header title={t("page.clinicalos_intake.title")} subtitle={t("page.clinicalos_intake.subtitle")} />
      <div className="p-6">
        <IntakeClient instances={instances} workflows={workflows} />
      </div>
    </div>
  )
}
