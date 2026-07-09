"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Plus, Loader2, Workflow, FileStack, Pencil, Trash2 } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { createWorkflowDefinitionAction, deleteWorkflowDefinitionAction, renameWorkflowDefinitionAction } from "@/lib/actions/workflow-studio"
import type { WorkflowDefinitionWithCount } from "@/lib/db/workflow-studio"
import { toast } from "@/store/ui.store"
import { useT } from "@/store/translations-context"
import { format } from "date-fns"
import { tr } from "date-fns/locale"

type Props = { workflows: WorkflowDefinitionWithCount[] }

function NewWorkflowDialog() {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(createWorkflowDefinitionAction, {})

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          {t("workflow.new.button")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("workflow.new.title")}</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4 mt-2">
          {state.message && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {state.message}
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("workflow.field.name")}</label>
            <Input name="name" placeholder={t("workflow.field.name_placeholder")} />
            {state?.errors?.name && <p className="text-xs text-destructive">{state.errors.name[0]}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("workflow.field.branch")}</label>
            <Input name="branch" placeholder={t("workflow.field.branch_placeholder")} />
            {state?.errors?.branch && <p className="text-xs text-destructive">{state.errors.branch[0]}</p>}
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              {t("action.dismiss")}
            </Button>
            <Button type="submit" disabled={pending} className="flex-1">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("action.create")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function RenameWorkflowDialog({ id, name }: { id: string; name: string }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(renameWorkflowDefinitionAction, {})

  useEffect(() => {
    if (!state.success) return
    toast.success(state.message ?? "Workflow adı güncellendi")
    setOpen(false)
  }, [state])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="relative z-10 h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
          onClick={() => setOpen(true)}
        >
          <Pencil className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("workflow.rename.title")}</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4 mt-2">
          <input type="hidden" name="id" value={id} />
          {state.message && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {state.message}
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("workflow.field.name")}</label>
            <Input name="name" defaultValue={name} autoFocus />
            {state?.errors?.name && <p className="text-xs text-destructive">{state.errors.name[0]}</p>}
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              {t("action.dismiss")}
            </Button>
            <Button type="submit" disabled={pending} className="flex-1">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("action.save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteWorkflowButton({ id, name }: { id: string; name: string }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(deleteWorkflowDefinitionAction, {})
  const formRef = useRef<HTMLFormElement>(null)

  // Silme engellendiğinde (bağlı kabul kaydı varsa) kullanıcıya nedenini göster.
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
        title={t("workflow.delete.title")}
        description={t("workflow.delete.description").replace("{{name}}", name)}
        pending={pending}
        onConfirm={() => formRef.current?.requestSubmit()}
      />
    </>
  )
}

export function StudioClient({ workflows }: Props) {
  const t = useT()
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/clinicalos/studio/forms">
          <Button variant="outline" className="gap-2">
            <FileStack className="h-4 w-4" />
            {t("workflow.form_builder_button")}
          </Button>
        </Link>
        <NewWorkflowDialog />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {workflows.map((wf) => (
          <Card key={wf.id} className="relative h-full transition-colors hover:border-primary/40">
            {/* Silme butonu form içerdiği için kart <Link> ile sarılamaz (a > form
                geçersiz HTML) — link overlay olarak kartı kaplar, buton z-10 ile üstte. */}
            <Link
              href={`/clinicalos/studio/${wf.id}`}
              className="absolute inset-0 rounded-xl"
              aria-label={wf.name}
            />
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2 min-w-0">
                  <Workflow className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{wf.name}</span>
                </CardTitle>
                <div className="flex items-center gap-1 shrink-0">
                  <Badge variant={wf.status === "published" ? "success" : "outline"} className="text-xs">
                    {wf.status === "published" ? t("workflow.status.published") : t("workflow.status.draft")}
                  </Badge>
                  <RenameWorkflowDialog id={wf.id} name={wf.name} />
                  <DeleteWorkflowButton id={wf.id} name={wf.name} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <p className="text-xs text-muted-foreground">{t("workflow.card.branch_prefix")}: {wf.branch}</p>
              <p className="text-xs text-muted-foreground">v{wf.version} · {wf._count.instances} {t("workflow.card.instance_suffix")}</p>
              <p className="text-[10px] text-muted-foreground/60">
                {t("workflow.card.updated_prefix")}: {format(wf.updatedAt, "d MMM yyyy", { locale: tr })}
              </p>
            </CardContent>
          </Card>
        ))}
        {workflows.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-full py-8 text-center">
            {t("workflow.empty")}
          </p>
        )}
      </div>
    </div>
  )
}
