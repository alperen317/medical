"use client"

import { useActionState, useEffect, useRef, useState, useTransition } from "react"
import { Plus, Loader2, Trash2, FileText, Pencil, History, X } from "lucide-react"
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
import {
  createFormDefinitionAction,
  updateFormDefinitionAction,
  deleteFormDefinitionAction,
  getFormVersionHistoryAction,
} from "@/lib/actions/workflow-studio"
import type { FormDefinitionRow } from "@/lib/db/workflow-studio"
import type { FormField, FormFieldType } from "@/lib/workflow/types"
import { cn } from "@/lib/utils"
import { toast } from "@/store/ui.store"
import { format } from "date-fns"
import { tr } from "date-fns/locale"

type Props = { forms: FormDefinitionRow[] }

const FIELD_TYPE_LABELS: Record<FormFieldType, string> = {
  text: "Metin",
  number: "Sayı",
  date: "Tarih",
  boolean: "Evet/Hayır",
  select: "Seçim",
  textarea: "Uzun Metin",
  file: "Dosya",
}

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"

function OptionsEditor({ options, onChange }: { options: string[]; onChange: (next: string[]) => void }) {
  const [draft, setDraft] = useState("")

  const addOption = () => {
    const value = draft.trim()
    if (!value || options.includes(value)) return
    onChange([...options, value])
    setDraft("")
  }

  return (
    <div className="ml-2 pl-3 border-l-2 space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt, i) => (
          <Badge key={i} variant="outline" className="text-[10px] gap-1 pr-1">
            {opt}
            <button
              type="button"
              onClick={() => onChange(options.filter((_, idx) => idx !== i))}
              className="hover:text-destructive"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </Badge>
        ))}
        {options.length === 0 && (
          <p className="text-[11px] text-muted-foreground">Henüz seçenek eklenmedi</p>
        )}
      </div>
      <div className="flex gap-1.5">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              addOption()
            }
          }}
          placeholder="Seçenek ekle..."
          className="h-7 text-xs flex-1"
        />
        <Button type="button" variant="outline" size="sm" className="h-7 px-2" onClick={addOption}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}

function FieldRow({
  field,
  onChange,
  onRemove,
}: {
  field: FormField
  onChange: (next: FormField) => void
  onRemove: () => void
}) {
  return (
    <div className="space-y-1.5 rounded-md border p-2">
      <div className="flex items-center gap-2">
        <Input
          value={field.label}
          onChange={(e) => onChange({ ...field, label: e.target.value })}
          placeholder="Alan etiketi"
          className="flex-1 min-w-0"
        />
        <Input
          value={field.id}
          onChange={(e) => onChange({ ...field, id: e.target.value })}
          placeholder="alan_id"
          className="w-32 shrink-0 font-mono text-xs"
        />
        <select
          value={field.type}
          onChange={(e) => onChange({ ...field, type: e.target.value as FormFieldType })}
          className={cn(selectClass, "w-32 shrink-0")}
        >
          {Object.entries(FIELD_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
          <input
            type="checkbox"
            checked={field.required}
            onChange={(e) => onChange({ ...field, required: e.target.checked })}
          />
          Zorunlu
        </label>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onRemove}>
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
      {field.type === "select" && (
        <OptionsEditor
          options={field.options ?? []}
          onChange={(next) => onChange({ ...field, options: next })}
        />
      )}
    </div>
  )
}

function FieldsEditor({
  fields,
  setFields,
}: {
  fields: FormField[]
  setFields: React.Dispatch<React.SetStateAction<FormField[]>>
}) {
  const addField = () => {
    setFields((prev) => [...prev, { id: `alan_${prev.length + 1}`, type: "text", label: "", required: false }])
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Alanlar</label>
        <Button type="button" variant="outline" size="sm" onClick={addField} className="gap-1.5">
          <Plus className="h-3 w-3" />
          Alan Ekle
        </Button>
      </div>
      {fields.map((field, i) => (
        <FieldRow
          key={i}
          field={field}
          onChange={(next) => setFields((prev) => prev.map((f, idx) => (idx === i ? next : f)))}
          onRemove={() => setFields((prev) => prev.filter((_, idx) => idx !== i))}
        />
      ))}
      <input type="hidden" name="fields" value={JSON.stringify(fields)} />
    </div>
  )
}

function NewFormDialog() {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(createFormDefinitionAction, {})
  const [fields, setFields] = useState<FormField[]>([
    { id: "alan_1", type: "text", label: "", required: false },
  ])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Yeni Form
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Yeni Form Şablonu</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4 mt-2">
          {state.message && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {state.message}
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Ad</label>
            <Input name="name" placeholder="Şikayet" />
            {state?.errors?.name && <p className="text-xs text-destructive">{state.errors.name[0]}</p>}
          </div>

          <FieldsEditor fields={fields} setFields={setFields} />
          {state?.errors?.fields && <p className="text-xs text-destructive">{state.errors.fields[0]}</p>}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={pending} className="flex-1">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Oluştur"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditFormDialog({ form }: { form: FormDefinitionRow }) {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(updateFormDefinitionAction, {})
  const initialFields = ((form.fields as unknown as FormField[]) ?? []).map((f) => ({ ...f }))
  const [fields, setFields] = useState<FormField[]>(initialFields)

  useEffect(() => {
    if (!state.success) return
    toast.success(state.message ?? "Form güncellendi")
    setOpen(false)
  }, [state])

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setFields(initialFields)
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          onClick={() => setOpen(true)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Formu Düzenle</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Kaydettiğinde yeni bir sürüm (v{form.version + 1}) oluşturulur. Bu formu zaten kullanan
          workflow&apos;lar v{form.version} ile çalışmaya devam eder — etkilenmezler.
        </p>
        <form action={action} className="space-y-4 mt-2">
          <input type="hidden" name="rootId" value={form.rootId} />
          {state.message && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {state.message}
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Ad</label>
            <Input name="name" defaultValue={form.name} />
            {state?.errors?.name && <p className="text-xs text-destructive">{state.errors.name[0]}</p>}
          </div>

          <FieldsEditor fields={fields} setFields={setFields} />
          {state?.errors?.fields && <p className="text-xs text-destructive">{state.errors.fields[0]}</p>}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={pending} className="flex-1">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Yeni Sürüm Kaydet"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function VersionHistoryDialog({ rootId, currentVersion }: { rootId: string; currentVersion: number }) {
  const [open, setOpen] = useState(false)
  const [versions, setVersions] = useState<FormDefinitionRow[] | null>(null)
  const [pending, startTransition] = useTransition()

  if (currentVersion <= 1) return null

  const handleOpen = () => {
    setOpen(true)
    startTransition(async () => {
      setVersions(await getFormVersionHistoryAction(rootId))
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          onClick={handleOpen}
        >
          <History className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sürüm Geçmişi</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {pending && <Loader2 className="h-4 w-4 animate-spin mx-auto" />}
          {versions?.map((v) => (
            <div key={v.id} className="rounded-md border p-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  v{v.version}
                  {v.isLatest && <span className="text-muted-foreground font-normal"> · güncel</span>}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {format(v.updatedAt, "d MMM yyyy HH:mm", { locale: tr })}
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {((v.fields as unknown as FormField[]) ?? []).map((f) => (
                  <Badge key={f.id} variant="outline" className="text-[10px]">
                    {f.label || f.id}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function DeleteFormButton({ rootId, name }: { rootId: string; name: string }) {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(deleteFormDefinitionAction, {})
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (!state.message) return
    if (state.success) toast.success(state.message)
    else toast.error(state.message)
  }, [state])

  return (
    <>
      <form ref={formRef} action={action}>
        <input type="hidden" name="rootId" value={rootId} />
      </form>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
      <ConfirmDialog
        open={open && !state.success}
        onOpenChange={setOpen}
        title="Formu sil"
        description={<>&ldquo;{name}&rdquo; formunu (tüm sürümleriyle) silmek üzeresiniz. Bu işlem geri alınamaz.</>}
        pending={pending}
        onConfirm={() => formRef.current?.requestSubmit()}
      />
    </>
  )
}

export function FormsClient({ forms }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <NewFormDialog />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {forms.map((form) => {
          const fields = (form.fields as unknown as FormField[]) ?? []
          return (
            <Card key={form.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base font-semibold flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{form.name}</span>
                  </CardTitle>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge variant="outline" className="text-[10px]">v{form.version}</Badge>
                    <EditFormDialog form={form} />
                    <VersionHistoryDialog rootId={form.rootId} currentVersion={form.version} />
                    <DeleteFormButton rootId={form.rootId} name={form.name} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-1.5">
                {fields.map((f) => (
                  <Badge key={f.id} variant="outline" className="text-[10px]">
                    {f.label || f.id}
                  </Badge>
                ))}
                {fields.length === 0 && (
                  <p className="text-xs text-muted-foreground">Alan yok</p>
                )}
              </CardContent>
            </Card>
          )
        })}
        {forms.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-full py-8 text-center">
            Henüz form şablonu oluşturulmadı.
          </p>
        )}
      </div>
    </div>
  )
}
