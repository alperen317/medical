import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { verifySession, requirePermission } from "@/lib/dal"
import { getFormDefinitions } from "@/lib/db/workflow-studio"
import { getServerT } from "@/lib/i18n/server"
import { FormsClient } from "./_components/forms-client"

export default async function FormBuilderPage() {
  const currentUser = await verifySession()
  requirePermission(currentUser, "workflow:manage")
  const t = await getServerT()

  const forms = await getFormDefinitions()

  return (
    <div>
      <Header title={t("page.form_builder.title")} subtitle={t("page.form_builder.subtitle")} />
      <div className="p-6 space-y-4">
        <Link href="/clinicalos/studio">
          <Button variant="ghost" size="sm" className="gap-2 -ml-2">
            <ArrowLeft className="h-4 w-4" />
            {t("nav.workflow_studio")}
          </Button>
        </Link>
        <FormsClient forms={forms} />
      </div>
    </div>
  )
}
