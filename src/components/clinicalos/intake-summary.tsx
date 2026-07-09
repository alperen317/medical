"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, FileStack, ListTodo, Loader2, Pencil, Trash2, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { updateAnswersAction, deleteWorkflowDocumentAction } from "@/lib/actions/clinicalos-intake"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import type { getWorkflowInstanceById } from "@/lib/db/clinicalos-intake"
import type { FormDefinitionRow } from "@/lib/db/workflow-studio"
import { humanizeDecision, visiblePathSteps, type PathStep } from "@/lib/workflow/path"
import { documentTypeLabel } from "@/lib/workflow/document-checklist"
import { buildIntakeMarkdown, fieldValueLabel } from "@/lib/workflow/intake-markdown"
import type { FormField } from "@/lib/workflow/types"
import { NODE_VISUALS, BRANCH_COLORS } from "@/lib/workflow/node-visuals"
import { DynamicFormRenderer } from "./dynamic-form-renderer"
import { IntakeMarkdownView } from "./intake-markdown-view"
import { toast } from "@/store/ui.store"
import { useT } from "@/store/translations-context"
import { cn } from "@/lib/utils"

type Instance = NonNullable<Awaited<ReturnType<typeof getWorkflowInstanceById>>>

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FormSummarySection({
  instanceId,
  title,
  fields,
  answers,
  readOnly,
}: {
  instanceId: string
  title: string
  fields: FormField[]
  answers: Record<string, unknown>
  readOnly: boolean
}) {
  const t = useT()
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [pending, startTransition] = useTransition()

  const submit = (values: Record<string, unknown>) => {
    startTransition(async () => {
      const result = await updateAnswersAction(instanceId, values)
      if (result.success) {
        toast.success(result.message ?? "Güncellendi")
        setEditing(false)
        router.refresh()
      } else {
        toast.error(result.message ?? "Güncellenemedi")
      }
    })
  }

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b">
        <p className="text-sm font-semibold">{title}</p>
        {!editing && !readOnly && (
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground" onClick={() => setEditing(true)}>
            <Pencil className="h-3 w-3" />
            {t("action.edit")}
          </Button>
        )}
      </div>

      {editing ? (
        <div className="px-3.5 py-3">
          <DynamicFormRenderer title="" fields={fields} pending={pending} onSubmit={submit} initialValues={answers} />
          <Button variant="ghost" size="sm" className="mt-1 h-7 gap-1.5 text-xs text-muted-foreground" onClick={() => setEditing(false)} disabled={pending}>
            <X className="h-3 w-3" />
            {t("action.dismiss")}
          </Button>
        </div>
      ) : (
        <dl className="px-3.5 py-2.5 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
          {fields.map((field) => (
            <div key={field.id} className="min-w-0">
              <dt className="text-[11px] text-muted-foreground truncate">{field.label || field.id}</dt>
              <dd className="text-sm truncate">{fieldValueLabel(field, answers[field.id])}</dd>
            </div>
          ))}
          {fields.length === 0 && <p className="text-xs text-muted-foreground">{t("form_builder.no_fields")}</p>}
        </dl>
      )}
    </div>
  )
}

function DocumentSummarySection({
  instanceId,
  nodeId,
  title,
  documents,
  readOnly,
}: {
  instanceId: string
  nodeId: string
  title: string
  documents: Instance["documents"]
  readOnly: boolean
}) {
  const t = useT()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDoc, setConfirmDoc] = useState<{ id: string; name: string } | null>(null)

  const upload = async () => {
    const file = fileInputRef.current?.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("retroNodeId", nodeId)
      const res = await fetch(`/api/clinicalos/instances/${instanceId}/documents`, { method: "POST", body: formData })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? "Yükleme başarısız")
        return
      }
      if (fileInputRef.current) fileInputRef.current.value = ""
      router.refresh()
    } finally {
      setUploading(false)
    }
  }

  const startDelete = async (documentId: string) => {
    setDeletingId(documentId)
    const result = await deleteWorkflowDocumentAction(documentId)
    setDeletingId(null)
    setConfirmDoc(null)
    if (result.success) {
      toast.success(result.message ?? "Silindi")
      router.refresh()
    } else {
      toast.error(result.message ?? "Silinemedi")
    }
  }

  return (
    <div className="rounded-lg border bg-card">
      <div className="px-3.5 py-2.5 border-b">
        <p className="text-sm font-semibold">{title}</p>
      </div>
      <div className="px-3.5 py-2.5 space-y-2">
        {documents.map((doc) => (
          <div key={doc.id} className="flex items-center justify-between gap-2 text-sm">
            <div className="min-w-0">
              {/* checklistLabel: bu belgenin hangi kalemi (ör. "Mamografi raporu")
                  karşıladığı — olmadan aynı dosya adıyla yüklenen belgeler
                  (ör. test verisi) birbirinden ayırt edilemiyordu. */}
              {doc.checklistLabel && (
                <p className="text-xs font-medium text-foreground truncate">{doc.checklistLabel}</p>
              )}
              <a
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "truncate text-primary hover:underline block",
                  doc.checklistLabel ? "text-xs" : "text-sm",
                )}
              >
                {doc.name}
              </a>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] text-muted-foreground">{formatBytes(doc.size)}</span>
              {!readOnly && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                  disabled={deletingId === doc.id}
                  onClick={() => setConfirmDoc({ id: doc.id, name: doc.name })}
                >
                  {deletingId === doc.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                </Button>
              )}
            </div>
          </div>
        ))}
        {documents.length === 0 && <p className="text-xs text-muted-foreground">{t("intake.summary.no_documents_short")}</p>}

        {!readOnly && (
          <div className="flex items-center gap-2 pt-1">
            <input ref={fileInputRef} type="file" className="text-xs flex-1 min-w-0" />
            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs shrink-0" onClick={upload} disabled={uploading}>
              {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
              {t("intake.summary.add_button")}
            </Button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDoc !== null}
        onOpenChange={(next) => { if (!next) setConfirmDoc(null) }}
        title={t("document.delete.title")}
        description={t("document.delete.description").replace("{{name}}", confirmDoc?.name ?? "")}
        pending={deletingId === confirmDoc?.id}
        onConfirm={() => confirmDoc && startDelete(confirmDoc.id)}
      />
    </div>
  )
}

function TaskSummarySection({ title, entries }: { title: string; entries: { completedAt: string }[] }) {
  const t = useT()
  return (
    <div className="rounded-lg border bg-card">
      <div className="px-3.5 py-2.5 border-b flex items-center gap-2">
        <ListTodo className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-sm font-semibold">{title}</p>
      </div>
      <div className="px-3.5 py-2.5">
        {entries.map((entry, i) => (
          <p key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            {t("intake.status.completed")}: {new Date(entry.completedAt).toLocaleString("tr-TR")}
          </p>
        ))}
        {entries.length === 0 && <p className="text-xs text-muted-foreground">{t("intake.summary.no_records")}</p>}
      </div>
    </div>
  )
}

export function IntakeSummary({
  instance,
  forms,
  visitedPath,
  readOnly = false,
  title,
  description,
}: {
  instance: Instance
  forms: FormDefinitionRow[]
  visitedPath: PathStep[]
  readOnly?: boolean
  title?: string
  description?: string
}) {
  const t = useT()
  const answers = instance.answers as Record<string, unknown>
  const tasks = Array.isArray(instance.tasks) ? (instance.tasks as { nodeId: string; completedAt: string }[]) : []

  return (
    <div className="space-y-4">
      {title && (
        <div className="text-center py-2">
          <div
            className={cn(
              "h-11 w-11 rounded-full flex items-center justify-center mx-auto mb-2",
              readOnly
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
                : "bg-muted text-muted-foreground",
            )}
          >
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium">{title}</p>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
      )}

      {readOnly ? (
        <IntakeMarkdownView markdown={buildIntakeMarkdown(instance, forms, visitedPath)} />
      ) : (
        <div className="space-y-3">
          {visiblePathSteps(visitedPath).map((step, i) => {
            if (step.kind === "decision") {
              const colors = BRANCH_COLORS[step.branch]
              const Icon = NODE_VISUALS.decision.icon
              return (
                <div key={`${step.node.id}-${i}`} className="flex items-center gap-2 pl-1 text-xs text-muted-foreground">
                  <Icon className="h-3 w-3" />
                  <span>{humanizeDecision(step.node.id)}</span>
                  <span className={cn("font-bold px-1.5 py-0.5 rounded-full", colors.bg, colors.text)}>
                    {step.branch === "then" ? `✓ ${t("common.yes")}` : `✓ ${t("common.no")}`}
                  </span>
                </div>
              )
            }

            if (step.kind === "form") {
              const formDef = forms.find((f) => f.id === step.node.formId)
              if (!formDef) return null
              return (
                <FormSummarySection
                  key={`${step.node.id}-${i}`}
                  instanceId={instance.id}
                  title={formDef.name}
                  fields={(formDef.fields as unknown as FormField[]) ?? []}
                  answers={answers}
                  readOnly={readOnly}
                />
              )
            }

            if (step.kind === "document") {
              return (
                <DocumentSummarySection
                  key={`${step.node.id}-${i}`}
                  instanceId={instance.id}
                  nodeId={step.node.id}
                  title={
                    documentTypeLabel(step.node.documentType)
                      ? `${t("intake.summary.document_section_prefix")} — ${documentTypeLabel(step.node.documentType)}`
                      : t("intake.summary.document_section_prefix")
                  }
                  documents={instance.documents.filter((d) => d.nodeId === step.node.id)}
                  readOnly={readOnly}
                />
              )
            }

            if (step.kind === "task") {
              return (
                <TaskSummarySection
                  key={`${step.node.id}-${i}`}
                  title={step.node.label ?? t("intake.task.default_label")}
                  entries={tasks.filter((task) => task.nodeId === step.node.id)}
                />
              )
            }

            return null
          })}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground text-center pt-1 flex items-center justify-center gap-1.5">
        <FileStack className="h-3 w-3" />
        {instance.documents.length} {t("intake.summary.document_count_suffix")} · {Object.keys(answers).length} {t("intake.summary.answer_count_suffix")}
      </p>
    </div>
  )
}
