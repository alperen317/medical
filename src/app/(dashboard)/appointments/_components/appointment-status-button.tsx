"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import { CheckCircle2, XCircle, UserX, Loader2 } from "lucide-react"
import { updateAppointmentStatusAction } from "@/lib/actions/appointments"
import { toast } from "@/store/ui.store"
import { useT } from "@/store/translations-context"

type Action = "completed" | "cancelled" | "no_show"

export function AppointmentStatusButton({
  id,
  status,
}: {
  id: string
  status: string
}) {
  const t = useT()
  const [confirm, setConfirm] = useState<Action | null>(null)
  const [isPending, startTransition] = useTransition()
  if (status !== "scheduled") return null

  const toastKey = {
    completed: "appointment.toast.completed",
    cancelled: "appointment.toast.cancelled",
    no_show: "appointment.toast.no_show",
  } as const

  function handleAction(action: Action) {
    startTransition(async () => {
      const result = await updateAppointmentStatusAction(id, action)
      if (result.success) {
        toast.success(t(toastKey[action]))
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
          className="gap-1.5 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-700 dark:hover:text-amber-300"
          onClick={() => setConfirm("no_show")}
        >
          <UserX className="h-3.5 w-3.5" />
          {t("status.appointment.no_show")}
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
              {confirm === "completed"
                ? t("appointment.complete.title")
                : confirm === "no_show"
                ? t("appointment.no_show.title")
                : t("appointment.cancel.title")}
            </DialogTitle>
            <DialogDescription>
              {confirm === "completed"
                ? t("appointment.complete.confirm")
                : confirm === "no_show"
                ? t("appointment.no_show.confirm")
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
              {confirm === "completed"
                ? t("appointment.complete.submit")
                : confirm === "no_show"
                ? t("appointment.no_show.submit")
                : t("appointment.cancel.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
