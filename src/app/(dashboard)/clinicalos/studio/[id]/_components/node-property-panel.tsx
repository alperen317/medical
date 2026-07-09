"use client"

import { useActionState, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Plus, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createRuleDefinitionAction } from "@/lib/actions/workflow-studio"
import type { FormDefinitionRow, RuleDefinitionRow } from "@/lib/db/workflow-studio"
import type { WorkflowNode } from "@/lib/workflow/types"

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"

type Props = {
  node: WorkflowNode
  forms: FormDefinitionRow[]
  rules: RuleDefinitionRow[]
  onChange: (next: WorkflowNode) => void
  onDelete: () => void
  onClose: () => void
}

function NewRuleInline({ onCreated }: { onCreated: () => void }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(createRuleDefinitionAction, {})

  if (state.success && open) {
    setOpen(false)
    onCreated()
    router.refresh()
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" className="gap-1.5 w-full" onClick={() => setOpen(true)}>
        <Plus className="h-3 w-3" />
        Yeni Kural
      </Button>
    )
  }

  return (
    <form action={action} className="space-y-2 rounded-md border p-2.5">
      {state.message && <p className="text-xs text-destructive">{state.message}</p>}
      <Input name="name" placeholder="Kural adı" className="h-8 text-xs" />
      <div className="flex gap-1.5">
        <Input name="field" placeholder="alan_id" className="h-8 text-xs flex-1" />
        <select name="operator" className={selectClass + " h-8 w-28 text-xs"}>
          <option value="equals">eşittir</option>
          <option value="not_equals">eşit değildir</option>
        </select>
      </div>
      <Input name="value" placeholder="değer (örn. true)" className="h-8 text-xs" />
      <div className="flex gap-1.5">
        <Button type="button" variant="ghost" size="sm" className="flex-1 h-8" onClick={() => setOpen(false)}>
          Vazgeç
        </Button>
        <Button type="submit" size="sm" className="flex-1 h-8" disabled={pending}>
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Kaydet"}
        </Button>
      </div>
    </form>
  )
}

export function NodePropertyPanel({ node, forms, rules, onChange, onDelete, onClose }: Props) {
  const canDelete = node.type !== "start" && node.type !== "end"

  return (
    <div className="w-72 shrink-0 border-l bg-card p-4 space-y-4 overflow-y-auto">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Node Özellikleri</p>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">ID</p>
        <p className="text-xs font-mono bg-muted rounded px-2 py-1">{node.id}</p>
      </div>

      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Tip</p>
        <p className="text-sm font-medium capitalize">{node.type}</p>
      </div>

      {node.type === "form" && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium">Form Şablonu</label>
          <select
            className={selectClass}
            value={node.formId ?? ""}
            onChange={(e) => onChange({ ...node, formId: e.target.value || undefined })}
          >
            <option value="">— Seçiniz —</option>
            {forms.map((f) => (
              <option key={f.id} value={f.id}>{f.name}{!f.isLatest ? ` (v${f.version} — eski)` : ""}</option>
            ))}
          </select>
        </div>
      )}

      {node.type === "decision" && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Kural</label>
            <select
              className={selectClass}
              value={node.ruleId ?? ""}
              onChange={(e) => onChange({ ...node, ruleId: e.target.value || undefined })}
            >
              <option value="">— Seçiniz —</option>
              {rules.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <NewRuleInline onCreated={() => {}} />
          <p className="text-[11px] text-muted-foreground">
            &ldquo;then&rdquo; (yeşil) ve &ldquo;else&rdquo; (kırmızı) çıkışlarını canvas üzerinde ilgili node&apos;lara bağlayın.
          </p>
        </div>
      )}

      {node.type === "document" && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Belge Tipi</label>
            <Input
              value={node.documentType ?? ""}
              onChange={(e) => onChange({ ...node, documentType: e.target.value })}
              placeholder="pathology, pet_scan, lab_report..."
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Checklist (beklenen belgeler)</label>
            <div className="space-y-1.5">
              {(node.checklist ?? []).map((item, i) => (
                <div key={i} className="flex items-center gap-1.5 rounded-md border p-1.5">
                  <Input
                    value={item.label}
                    onChange={(e) => {
                      const next = [...(node.checklist ?? [])]
                      next[i] = { ...item, label: e.target.value }
                      onChange({ ...node, checklist: next })
                    }}
                    placeholder="ör. Mamografi raporu"
                    className="h-7 text-xs flex-1"
                  />
                  <label className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={item.required}
                      onChange={(e) => {
                        const next = [...(node.checklist ?? [])]
                        next[i] = { ...item, required: e.target.checked }
                        onChange({ ...node, checklist: next })
                      }}
                    />
                    Zorunlu
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => {
                      const next = (node.checklist ?? []).filter((_, idx) => idx !== i)
                      onChange({ ...node, checklist: next })
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 w-full"
              onClick={() =>
                onChange({ ...node, checklist: [...(node.checklist ?? []), { label: "", required: true }] })
              }
            >
              <Plus className="h-3 w-3" />
              Kalem Ekle
            </Button>
          </div>
        </div>
      )}

      {node.type === "task" && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium">Görev Etiketi</label>
          <Input
            value={node.label ?? ""}
            onChange={(e) => onChange({ ...node, label: e.target.value })}
            placeholder="Son Kontrol"
          />
        </div>
      )}

      {canDelete && (
        <Button variant="ghost" size="sm" className="w-full gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
          Node&apos;u Sil
        </Button>
      )}
    </div>
  )
}
