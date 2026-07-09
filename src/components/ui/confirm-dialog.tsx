"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** Verilirse, onay butonu kullanıcı bu metni birebir yazana kadar kapalı kalır. */
  requireTypedConfirmation?: string
  pending?: boolean
  onConfirm: () => void
}

// Yıkıcı işlemler için paylaşılan onay diyaloğu — tarayıcının bloklayan
// `confirm()`'i yerine geçer. `requireTypedConfirmation` verilmişse (ör. hasta
// adı) kullanıcı bunu birebir yazmadan silme butonu etkinleşmez.
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Sil",
  cancelLabel = "Vazgeç",
  requireTypedConfirmation,
  pending,
  onConfirm,
}: Props) {
  const [typed, setTyped] = useState("")
  const canConfirm = !requireTypedConfirmation || typed === requireTypedConfirmation

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) setTyped("")
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {requireTypedConfirmation && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Onaylamak için <span className="font-semibold text-foreground">{requireTypedConfirmation}</span> yazın
            </label>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={requireTypedConfirmation}
              autoComplete="off"
              autoFocus
            />
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={!canConfirm || pending}
            className="gap-2"
          >
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
