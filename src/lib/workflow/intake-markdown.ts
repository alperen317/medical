import type { getWorkflowInstanceById } from "@/lib/db/clinicalos-intake"
import type { FormDefinitionRow } from "@/lib/db/workflow-studio"
import type { FormField } from "./types"
import { visiblePathSteps, type PathStep } from "./path"
import { documentTypeLabel } from "./document-checklist"

type Instance = NonNullable<Awaited<ReturnType<typeof getWorkflowInstanceById>>>

export function fieldValueLabel(field: FormField, value: unknown): string {
  if (value === undefined || value === null || value === "") return "—"
  if (field.type === "boolean") return value ? "Evet" : "Hayır"
  return String(value)
}

function escapeCell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\n/g, " ")
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Toplanan kabul verisini LLM'siz, doğrudan veriden Markdown'a çevirir.
 * Tıbbi veri olduğu için hiçbir alan yorumlanmaz, özetlenmez ya da atlanmaz —
 * yalnızca visitedPath'teki sıraya göre biçimlendirilir. IntakeSummary'nin
 * readOnly modunda (Son Kontrol ekranı, /patients "Hasta Kabul Formu" sekmesi)
 * interaktif kart listesi yerine bu çıktı render edilir.
 */
export function buildIntakeMarkdown(
  instance: Instance,
  forms: FormDefinitionRow[],
  visitedPath: PathStep[],
): string {
  const answers = instance.answers as Record<string, unknown>
  const tasks = Array.isArray(instance.tasks) ? (instance.tasks as { nodeId: string; completedAt: string }[]) : []
  const lines: string[] = []

  for (const step of visiblePathSteps(visitedPath)) {
    // Karar node'ları (ör. "Meme: Evet") rota bilgisidir, hasta verisi değil —
    // bu belge yalnızca toplanan formu/belgeleri/görevleri gösterir; karar
    // izleri Adımlar panelinde (StepTrace) zaten görünür.
    if (step.kind === "decision") continue

    if (step.kind === "form") {
      const formDef = forms.find((f) => f.id === step.node.formId)
      if (!formDef) continue
      const fields = (formDef.fields as unknown as FormField[]) ?? []
      lines.push(`## ${formDef.name}`, "")
      if (fields.length === 0) {
        lines.push("_Alan yok_", "")
      } else {
        lines.push("| Alan | Değer |", "|---|---|")
        for (const field of fields) {
          lines.push(`| ${escapeCell(field.label || field.id)} | ${escapeCell(fieldValueLabel(field, answers[field.id]))} |`)
        }
        lines.push("")
      }
      continue
    }

    if (step.kind === "document") {
      const docs = instance.documents.filter((d) => d.nodeId === step.node.id)
      const title = documentTypeLabel(step.node.documentType)
      lines.push(title ? `## Belge — ${title}` : "## Belge", "")
      if (docs.length === 0) {
        lines.push("_Belge yok_", "")
      } else {
        for (const doc of docs) {
          const label = doc.checklistLabel ? `${escapeCell(doc.checklistLabel)} — ` : ""
          lines.push(`- ${label}[${escapeCell(doc.name)}](${doc.url}) (${formatBytes(doc.size)})`)
        }
        lines.push("")
      }
      continue
    }

    if (step.kind === "task") {
      const entries = tasks.filter((t) => t.nodeId === step.node.id)
      lines.push(`## ${step.node.label ?? "Görev"}`, "")
      if (entries.length === 0) {
        lines.push("_Kayıt yok_", "")
      } else {
        for (const entry of entries) {
          lines.push(`- ✓ Tamamlandı: ${new Date(entry.completedAt).toLocaleString("tr-TR")}`)
        }
        lines.push("")
      }
      continue
    }
  }

  return lines.join("\n").trim()
}
