import { Header } from "@/components/layout/header"
import { verifySession, requirePermission } from "@/lib/dal"
import { getWorkflowInstances, getPublishedWorkflowDefinitions } from "@/lib/db/clinicalos-intake"
import { IntakeClient } from "./_components/intake-client"

export default async function PatientIntakePage() {
  const currentUser = await verifySession()
  requirePermission(currentUser, "intake:execute")

  const [instances, workflows] = await Promise.all([
    getWorkflowInstances(),
    getPublishedWorkflowDefinitions(),
  ])

  return (
    <div>
      <Header title="Hasta Kabul (Intake)" subtitle="Devam eden kabul akışlarını görüntüleyin veya yeni bir kabul başlatın" />
      <div className="p-6">
        <IntakeClient instances={instances} workflows={workflows} />
      </div>
    </div>
  )
}
