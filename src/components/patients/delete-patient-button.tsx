"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { deletePatientAction } from "@/lib/actions/patients"
import { toast } from "@/store/ui.store"
import { useT } from "@/store/translations-context"

type Props = {
  patientId: string
  patientName: string
  /** Server Component parent'lar için: silme başarılı olunca yönlendirilecek yol. */
  redirectTo?: string
  /** Client Component parent'lar için: silme başarılı olunca çağrılır (ör. listeden kaldırma). */
  onDeleted?: () => void
  variant?: "outline" | "ghost"
  className?: string
  /** Sadece ikon göster, metin etiketini gizle (ör. sıkışık liste satırları). */
  iconOnly?: boolean
}

export function DeletePatientButton({
  patientId,
  patientName,
  redirectTo,
  onDeleted,
  variant = "outline",
  className,
  iconOnly = false,
}: Props) {
  const t = useT()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(deletePatientAction, {})
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (!state.message) return
    if (state.success) {
      toast.success(state.message)
      onDeleted?.()
      if (redirectTo) router.push(redirectTo)
    } else {
      toast.error(state.message)
    }
  }, [state, onDeleted, redirectTo, router])

  return (
    <>
      <form ref={formRef} action={action}>
        <input type="hidden" name="patientId" value={patientId} />
      </form>
      <Button
        type="button"
        variant={variant}
        size="sm"
        className={className ?? "gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen(true)
        }}
        title={t("action.delete")}
      >
        <Trash2 className="h-4 w-4" />
        {!iconOnly && <span className="hidden sm:inline">{t("action.delete")}</span>}
      </Button>
      <ConfirmDialog
        open={open && !state.success}
        onOpenChange={setOpen}
        title={t("patient.delete.title")}
        description={t("patient.delete.description").replace("{{name}}", patientName)}
        requireTypedConfirmation={patientName}
        pending={pending}
        onConfirm={() => formRef.current?.requestSubmit()}
      />
    </>
  )
}
