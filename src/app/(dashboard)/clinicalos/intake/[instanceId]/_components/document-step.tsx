"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  CheckCircle2,
  FileStack,
  FileText,
  FlaskConical,
  Loader2,
  Microscope,
  Paperclip,
  Scan,
  Trash2,
  Upload,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { deleteWorkflowDocumentAction } from "@/lib/actions/clinicalos-intake"
import { documentTypeLabel, isChecklistSatisfied } from "@/lib/workflow/document-checklist"
import { NODE_VISUALS } from "@/lib/workflow/node-visuals"
import type { getWorkflowInstanceById } from "@/lib/db/clinicalos-intake"
import type { DocumentChecklistItem, DocumentNode } from "@/lib/workflow/types"
import { toast } from "@/store/ui.store"
import { cn } from "@/lib/utils"

type Instance = NonNullable<Awaited<ReturnType<typeof getWorkflowInstanceById>>>
type WorkflowDocument = Instance["documents"][number]
type Category = NonNullable<DocumentChecklistItem["category"]>

const CATEGORY_META: Record<Category, { label: string; icon: typeof Microscope }> = {
  patoloji: { label: "Patoloji", icon: Microscope },
  goruntuleme: { label: "Görüntüleme", icon: Scan },
  laboratuvar: { label: "Laboratuvar", icon: FlaskConical },
  diger: { label: "Diğer", icon: FileText },
}

// Checklist'te karşılığı olmayan/serbest yüklemeler (checklistLabel === null)
// için tek bir sabit anahtar — uploadingKeys Set'inde checklist label'larıyla
// karışmasın diye.
const EXTRA_KEY = "__extra__"

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function groupChecklist(checklist: DocumentChecklistItem[]) {
  const groups = new Map<Category, DocumentChecklistItem[]>()
  for (const item of checklist) {
    const key = item.category ?? "diger"
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(item)
  }
  return groups
}

function DocumentChip({
  doc,
  deleting,
  onRequestDelete,
}: {
  doc: WorkflowDocument
  deleting: boolean
  onRequestDelete: () => void
}) {
  return (
    <li className="flex items-center gap-2 text-xs">
      <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <a
        href={doc.url}
        target="_blank"
        rel="noopener noreferrer"
        className="truncate text-primary hover:underline flex-1 min-w-0"
      >
        {doc.name}
      </a>
      <span className="text-muted-foreground shrink-0">{formatBytes(doc.size)}</span>
      <button
        type="button"
        onClick={onRequestDelete}
        disabled={deleting}
        className="shrink-0 text-muted-foreground hover:text-destructive disabled:opacity-50"
      >
        {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
      </button>
    </li>
  )
}

function UploadTarget({
  compact,
  uploading,
  onSelect,
  children,
}: {
  compact: boolean
  uploading: boolean
  onSelect: (file: File) => void
  children: React.ReactNode
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files[0]
        if (file) onSelect(file)
      }}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed text-xs transition-colors",
        compact ? "px-2.5 py-1 shrink-0" : "flex-col justify-center gap-1.5 py-7 text-center text-sm",
        dragOver ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-muted/40",
      )}
    >
      {uploading ? <Loader2 className={cn("animate-spin", compact ? "h-3 w-3" : "h-6 w-6")} /> : children}
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onSelect(file)
          e.target.value = ""
        }}
      />
    </div>
  )
}

function ChecklistItemRow({
  item,
  documents,
  uploading,
  deletingId,
  onUpload,
  onRequestDelete,
}: {
  item: DocumentChecklistItem
  documents: WorkflowDocument[]
  uploading: boolean
  deletingId: string | null
  onUpload: (file: File) => void
  onRequestDelete: (doc: WorkflowDocument) => void
}) {
  const satisfied = documents.length > 0
  const missing = item.required && !satisfied

  return (
    <div className={cn("px-3.5 py-2", missing && "bg-amber-50/60 dark:bg-amber-950/20")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          {satisfied ? (
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
          ) : (
            <span
              className={cn(
                "mt-1.5 h-1.5 w-1.5 rounded-full shrink-0",
                item.required ? "bg-amber-500" : "bg-muted-foreground/30",
              )}
            />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className={cn("text-sm leading-snug", item.required ? "text-foreground font-medium" : "text-muted-foreground")}>
                {item.label}
              </p>
              {missing && (
                <Badge variant="warning" className="px-1.5 py-0 text-[10px] font-semibold leading-4">
                  Zorunlu
                </Badge>
              )}
              {!item.required && (
                <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-medium leading-4 text-muted-foreground">
                  Opsiyonel
                </Badge>
              )}
            </div>
          </div>
        </div>

        <UploadTarget compact uploading={uploading} onSelect={onUpload}>
          <Upload className="h-3 w-3" />
          Yükle
        </UploadTarget>
      </div>

      {documents.length > 0 && (
        <ul className="mt-1.5 space-y-1 pl-3.5">
          {documents.map((doc) => (
            <DocumentChip
              key={doc.id}
              doc={doc}
              deleting={deletingId === doc.id}
              onRequestDelete={() => onRequestDelete(doc)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

export function DocumentStep({
  instanceId,
  node,
  documents,
  pending,
  onAdvance,
}: {
  instanceId: string
  node: DocumentNode
  documents: WorkflowDocument[]
  pending: boolean
  onAdvance: () => void
}) {
  const router = useRouter()
  const [uploadingKeys, setUploadingKeys] = useState<Set<string>>(new Set())
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDoc, setConfirmDoc] = useState<{ id: string; name: string } | null>(null)

  const checklist = node.checklist ?? []
  const groups = groupChecklist(checklist)
  const requiredItems = checklist.filter((item) => item.required)
  const title = documentTypeLabel(node.documentType)
  const complete = isChecklistSatisfied(checklist, documents)

  const extraDocuments = documents.filter(
    (doc) => !doc.checklistLabel || !checklist.some((item) => item.label === doc.checklistLabel),
  )

  const uploadedRequiredCount = requiredItems.filter((item) =>
    documents.some((d) => d.checklistLabel === item.label),
  ).length
  const allRequiredUploaded = requiredItems.length === 0 || uploadedRequiredCount === requiredItems.length

  // İki kolona bölünmüş kategori grupları — geniş ekranda checklist'in tamamı
  // tek uzun sütun yerine yan yana aksın, sağdaki "Devam Et" paneli sayfa
  // kaydırılmadan görünsün diye.
  const categoryEntries = Array.from(groups.entries())
  const splitAt = Math.ceil(categoryEntries.length / 2)
  const leftCategories = categoryEntries.slice(0, splitAt)
  const rightCategories = categoryEntries.slice(splitAt)
  const twoColumns = rightCategories.length > 0

  function renderCategoryGroup([category, items]: [Category, DocumentChecklistItem[]]) {
    const meta = CATEGORY_META[category]
    const Icon = meta.icon
    return (
      <div key={category}>
        <div className="flex items-center gap-1.5 px-3.5 pt-2.5">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-[11px] font-medium text-muted-foreground">{meta.label}</p>
        </div>
        <div className="divide-y">
          {items.map((item) => (
            <ChecklistItemRow
              key={item.label}
              item={item}
              documents={documents.filter((d) => d.checklistLabel === item.label)}
              uploading={uploadingKeys.has(item.label)}
              deletingId={deletingId}
              onUpload={(file) => upload(file, item.label)}
              onRequestDelete={(doc) => setConfirmDoc({ id: doc.id, name: doc.name })}
            />
          ))}
        </div>
      </div>
    )
  }

  async function upload(file: File, checklistLabel: string | null) {
    const key = checklistLabel ?? EXTRA_KEY
    setUploadingKeys((prev) => new Set(prev).add(key))
    try {
      const formData = new FormData()
      formData.append("file", file)
      if (checklistLabel) formData.append("checklistLabel", checklistLabel)
      const res = await fetch(`/api/clinicalos/instances/${instanceId}/documents`, {
        method: "POST",
        body: formData,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? "Yükleme başarısız")
        return
      }
      router.refresh()
    } finally {
      setUploadingKeys((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }

  async function startDelete(documentId: string) {
    setDeletingId(documentId)
    const result = await deleteWorkflowDocumentAction(documentId)
    setDeletingId(null)
    setConfirmDoc(null)
    if (result.success) router.refresh()
    else toast.error(result.message ?? "Silinemedi")
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", NODE_VISUALS.document.bg, NODE_VISUALS.document.color)}>
          <FileStack className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold leading-tight">
            {title ? `${title} Belgeleri` : "Belge Yükle"}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {requiredItems.length > 0
              ? "Her belge kaleminin kendi yükleme alanına dosyayı bırakın veya seçin."
              : "Kabul için gereken belgeleri aşağıdan yükleyin."}
          </p>
        </div>
      </div>

      {checklist.length > 0 ? (
        <div className="space-y-5">
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b bg-muted/30">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Beklenen belgeler
              </p>
              {requiredItems.length > 0 && (
                <span
                  className={cn(
                    "text-[11px] font-medium shrink-0",
                    allRequiredUploaded ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400",
                  )}
                >
                  {uploadedRequiredCount} / {requiredItems.length} zorunlu yüklendi
                </span>
              )}
            </div>
            <div className={cn("grid grid-cols-1", twoColumns && "sm:grid-cols-2 sm:divide-x")}>
              <div className="divide-y">{leftCategories.map(renderCategoryGroup)}</div>
              {twoColumns && <div className="divide-y">{rightCategories.map(renderCategoryGroup)}</div>}
            </div>
          </div>

          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="px-3.5 py-2 border-b bg-muted/30">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ek belgeler</p>
            </div>
            <div className="px-3.5 py-2.5 space-y-2">
              {extraDocuments.length > 0 && (
                <ul className="space-y-1">
                  {extraDocuments.map((doc) => (
                    <DocumentChip
                      key={doc.id}
                      doc={doc}
                      deleting={deletingId === doc.id}
                      onRequestDelete={() => setConfirmDoc({ id: doc.id, name: doc.name })}
                    />
                  ))}
                </ul>
              )}
              <UploadTarget compact={false} uploading={uploadingKeys.has(EXTRA_KEY)} onSelect={(file) => upload(file, null)}>
                <Paperclip className="h-4 w-4 text-muted-foreground/60" />
                <span className="text-muted-foreground">
                  Listede olmayan bir belge mi var? Sürükleyin veya <span className="text-primary font-medium">seçin</span>
                </span>
              </UploadTarget>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-3.5 space-y-3">
            {requiredItems.length > 0 && (
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", allRequiredUploaded ? "bg-emerald-500" : "bg-amber-500")}
                  style={{ width: `${(uploadedRequiredCount / requiredItems.length) * 100}%` }}
                />
              </div>
            )}
            <Button onClick={onAdvance} disabled={pending || !complete} className="w-full gap-2">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Devam Et
            </Button>
            <p
              className={cn(
                "text-xs font-medium",
                !complete && requiredItems.length > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
              )}
            >
              {!complete && requiredItems.length > 0
                ? "“Zorunlu” işaretli belgelerin tümü yüklenince devam edebilirsiniz."
                : "Tüm zorunlu belgeler tamam, devam edebilirsiniz."}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="px-3.5 py-2.5 border-b bg-muted/30">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Belgeler</p>
            </div>
            <div className="px-3.5 py-2.5 space-y-2">
              {extraDocuments.length > 0 && (
                <ul className="space-y-1">
                  {extraDocuments.map((doc) => (
                    <DocumentChip
                      key={doc.id}
                      doc={doc}
                      deleting={deletingId === doc.id}
                      onRequestDelete={() => setConfirmDoc({ id: doc.id, name: doc.name })}
                    />
                  ))}
                </ul>
              )}
              <UploadTarget compact={false} uploading={uploadingKeys.has(EXTRA_KEY)} onSelect={(file) => upload(file, null)}>
                <Upload className="h-6 w-6 text-muted-foreground/60" />
                <span className="text-muted-foreground">
                  Dosyayı sürükleyin veya <span className="text-primary font-medium">seçin</span>
                </span>
                <span className="text-xs text-muted-foreground">Maks. 10 MB</span>
              </UploadTarget>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-3.5 space-y-3">
            <Button onClick={onAdvance} disabled={pending || !complete} className="w-full gap-2">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Devam Et
            </Button>
            <p className={cn("text-xs font-medium", !complete ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
              {!complete ? "Devam etmeden önce en az bir belge yükleyin." : "Belge yüklendi, devam edebilirsiniz."}
            </p>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDoc !== null}
        onOpenChange={(next) => { if (!next) setConfirmDoc(null) }}
        title="Belgeyi sil"
        description={<>&ldquo;{confirmDoc?.name}&rdquo; belgesini silmek üzeresiniz. Bu işlem geri alınamaz.</>}
        pending={deletingId === confirmDoc?.id}
        onConfirm={() => confirmDoc && startDelete(confirmDoc.id)}
      />
    </div>
  )
}
