import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { verifySession, requirePermission } from "@/lib/dal"
import { getFormDefinitions } from "@/lib/db/workflow-studio"
import { FormsClient } from "./_components/forms-client"

export default async function FormBuilderPage() {
  const currentUser = await verifySession()
  requirePermission(currentUser, "workflow:manage")

  const forms = await getFormDefinitions()

  return (
    <div>
      <Header title="Form Builder" subtitle="Workflow'larda kullanılacak form şablonlarını yönetin" />
      <div className="p-6 space-y-4">
        <Link href="/clinicalos/studio">
          <Button variant="ghost" size="sm" className="gap-2 -ml-2">
            <ArrowLeft className="h-4 w-4" />
            Workflow Studio
          </Button>
        </Link>
        <FormsClient forms={forms} />
      </div>
    </div>
  )
}
