"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import { CheckCircle2, XCircle, Loader2 } from "lucide-react"
import { updateAppointmentStatusAction } from "@/lib/actions/appointments"
import { toast } from "@/store/ui.store"
import { useT } from "@/store/translations-context"

export function AppointmentStatusButton({
  id,
  status,
}: {
  id: string
  status: string
}) {
  const t = useT()
  const [confirm, setConfirm] = useState<"completed" | "cancelled" | null>(null)
  const [isPending, startTransition] = useTransition()
  if (status !== "scheduled") return null

  function handleAction(action: "completed" | "cancelled") {
    startTransition(async () => {
      const result = await updateAppointmentStatusAction(id, action)
      if (result.success) {
        toast.success(action === "completed" ? t("appointment.toast.completed") : t("appointment.toast.cancelled"))
      } else {
        toast.error(result.message)
      }
      setConfirm(null)
    })
  }

  return (
    <>
      <div className="flex gap-1">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-300"
          onClick={() => setConfirm("completed")}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          {t("action.complete")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5"
          onClick={() => setConfirm("cancelled")}
        >
          <XCircle className="h-3.5 w-3.5" />
          {t("action.cancel")}
        </Button>
      </div>

      <Dialog open={confirm !== null} onOpenChange={(v) => !v && setConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {confirm === "completed" ? t("appointment.complete.title") : t("appointment.cancel.title")}
            </DialogTitle>
            <DialogDescription>
              {confirm === "completed"
                ? t("appointment.complete.confirm")
                : t("appointment.cancel.confirm")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              {t("action.dismiss")}
            </Button>
            <Button
              variant={confirm === "cancelled" ? "destructive" : "default"}
              disabled={isPending}
              onClick={() => confirm && handleAction(confirm)}
              className="gap-2"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {confirm === "completed" ? t("appointment.complete.submit") : t("appointment.cancel.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
