"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Plus, Loader2, Trash2, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { startIntakeAction, deleteIntakeInstanceAction } from "@/lib/actions/clinicalos-intake"
import type { WorkflowInstanceRow } from "@/lib/db/clinicalos-intake"
import { toast } from "@/store/ui.store"
import { format } from "date-fns"
import { tr } from "date-fns/locale"

type WorkflowOption = { id: string; name: string; branch: string }

type Props = {
  instances: WorkflowInstanceRow[]
  workflows: WorkflowOption[]
}

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"

function humanizeNodeId(id: string): string {
  return id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function NewIntakeDialog({ workflows }: { workflows: WorkflowOption[] }) {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(startIntakeAction, {})

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Yeni Kabul Başlat
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Yeni Hasta Kabulü</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4 mt-2">
          {state.message && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {state.message}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Workflow</label>
            <select name="workflowDefId" className={selectClass}>
              <option value="">— Seçiniz —</option>
              {workflows.map((wf) => (
                <option key={wf.id} value={wf.id}>{wf.name} ({wf.branch})</option>
              ))}
            </select>
            {state?.errors?.workflowDefId && <p className="text-xs text-destructive">{state.errors.workflowDefId[0]}</p>}
            {workflows.length === 0 && (
              <p className="text-xs text-muted-foreground">Yayında (published) workflow yok. Önce Workflow Studio&apos;dan bir workflow yayınlayın.</p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={pending} className="flex-1">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Kabulü Başlat"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteIntakeButton({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(deleteIntakeInstanceAction, {})
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (!state.message) return
    if (state.success) toast.success(state.message)
    else toast.error(state.message)
  }, [state])

  return (
    <>
      <form ref={formRef} action={action}>
        <input type="hidden" name="id" value={id} />
      </form>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="relative z-10 h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
      <ConfirmDialog
        open={open && !state.success}
        onOpenChange={setOpen}
        title="Hasta kabul kaydını sil"
        description={
          <>
            &ldquo;{name}&rdquo; hastasının kabul kaydını ve yüklenen tüm belgelerini kalıcı olarak
            sileceksiniz. Bu işlem geri alınamaz.
          </>
        }
        requireTypedConfirmation={name}
        pending={pending}
        onConfirm={() => formRef.current?.requestSubmit()}
      />
    </>
  )
}

export function IntakeClient({ instances, workflows }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <NewIntakeDialog workflows={workflows} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {instances.map((instance) => (
          <Card key={instance.id} className="relative h-full transition-colors hover:border-primary/40">
            {/* Silme butonu form içerdiği için kart <Link> ile sarılamaz —
                link overlay olarak kartı kaplar, buton z-10 ile üstte kalır. */}
            <Link
              href={`/clinicalos/intake/${instance.id}`}
              className="absolute inset-0 rounded-xl"
              aria-label={`${instance.patient.firstName} ${instance.patient.lastName}`}
            />
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2 min-w-0">
                  <UserPlus className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{instance.patient.firstName} {instance.patient.lastName}</span>
                </CardTitle>
                <div className="flex items-center gap-1 shrink-0">
                  <Badge variant={instance.status === "completed" ? "success" : "info"} className="text-xs">
                    {instance.status === "completed" ? "Tamamlandı" : "Devam Ediyor"}
                  </Badge>
                  <DeleteIntakeButton id={instance.id} name={`${instance.patient.firstName} ${instance.patient.lastName}`} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <p className="text-xs text-muted-foreground">{instance.workflowDef.name}</p>
              <p className="text-xs text-muted-foreground">
                Adım: {humanizeNodeId(instance.currentNodeId)}
              </p>
              <p className="text-[10px] text-muted-foreground/60">
                Başlangıç: {format(instance.startedAt, "d MMM yyyy HH:mm", { locale: tr })}
              </p>
            </CardContent>
          </Card>
        ))}
        {instances.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-full py-8 text-center">
            Henüz kabul kaydı yok.
          </p>
        )}
      </div>
    </div>
  )
}
