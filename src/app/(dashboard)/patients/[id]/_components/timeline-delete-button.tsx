"use client"

import { useState, useTransition } from "react"
import { Trash2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { deleteTimelineEventAction } from "@/lib/actions/timeline"
import { toast } from "@/store/ui.store"

export function TimelineDeleteButton({
  eventId,
  patientId,
}: {
  eventId: string
  patientId: string
}) {
  const [confirming, setConfirming] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteTimelineEventAction(eventId, patientId)
      if (result.success) {
        toast.success("Kayıt silindi")
      } else {
        toast.error(result.message ?? "Kayıt silinemedi")
        setConfirming(false)
      }
    })
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-xs text-muted-foreground whitespace-nowrap">Emin misin?</span>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs"
          disabled={isPending}
          onClick={() => setConfirming(false)}
        >
          İptal
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className="h-6 px-2 text-xs gap-1"
          disabled={isPending}
          onClick={handleDelete}
        >
          {isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Trash2 className="h-3 w-3" />
          )}
          Sil
        </Button>
      </div>
    )
  }

  return (
    <Button
      size="icon"
      variant="ghost"
      className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
      onClick={() => setConfirming(true)}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  )
}
