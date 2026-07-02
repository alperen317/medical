"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, FileText, ChevronDown, ChevronUp, Download, Calendar, BrainCircuit, FlaskConical } from "lucide-react"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { DocumentUploadDialog } from "./document-upload-dialog"
import type { LabValue } from "@/lib/ai/lab-report"

export type DocumentAttachment = {
  id: string
  name: string
  url: string
  size: number
  type: string
}

export type DocumentMetadata = {
  documentType?: string
  pdfText?: string
  aiReport?: string | null
  extractedValues?: LabValue[] | null
  aiError?: string | null
  /** MR/beyin analizi gibi AI-lab-raporu olmayan belgeleri ayırt etmek için. */
  analysisType?: string
}

export type DocumentEvent = {
  id: string
  title: string
  description: string
  date: string | Date
  metadata: DocumentMetadata | null
  createdBy: { id: string; name: string }
  attachments: DocumentAttachment[]
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  biyokimya:   "Biyokimya",
  tam_kan:     "Tam Kan",
  lipid:       "Lipid",
  tiroid:      "Tiroid",
  idrar:       "İdrar",
  hormon:      "Hormon",
  goruntuleme: "Görüntüleme",
  diger:       "Belge",
}

const STATUS_STYLES: Record<LabValue["status"], { badge: string; row: string }> = {
  normal:   { badge: "bg-green-100 text-green-700",  row: "" },
  high:     { badge: "bg-red-100 text-red-700",      row: "bg-red-50/50" },
  low:      { badge: "bg-blue-100 text-blue-700",    row: "bg-blue-50/50" },
  critical: { badge: "bg-red-200 text-red-800 font-bold", row: "bg-red-100/60" },
}

const STATUS_LABELS: Record<LabValue["status"], string> = {
  normal: "Normal", high: "Yüksek", low: "Düşük", critical: "Kritik",
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Satır-içi **kalın** markdown'ı gerçek <strong>'a çevirir. Hangi format dalına
// düşülürse düşülsün ham `**` işaretlerinin ekranda kalmasını önler.
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  if (parts.length === 1) return text
  return parts.map((part, i) => {
    const m = part.match(/^\*\*([^*]+)\*\*$/)
    return m
      ? <strong key={i} className="font-semibold text-foreground">{m[1]}</strong>
      : <span key={i}>{part}</span>
  })
}

export function AiReportText({ text }: { text: string }) {
  // Format A: ## Heading\ncontent (markdown headings)
  if (/^##\s+/m.test(text)) {
    return <SectionedReport text={text} splitPattern={/^##\s+/m} />
  }

  // Format B: "1. Heading:\ncontent" or "1. Heading\ncontent" (numbered sections)
  if (/^\d+\.\s+[A-ZÇĞİÖŞÜ]/m.test(text)) {
    return <SectionedReport text={text} splitPattern={/(?=^\d+\.\s+)/m} numbered />
  }

  // Format C: **bold heading** style (Qwen/Biomni models)
  if (/^\*\*[^*]+\*\*/m.test(text)) {
    return <BoldHeadingReport text={text} />
  }

  // Format C: legacy "Header - body" flat text
  const normalised = text
    .replace(/\.\s*-\s+(?=[A-ZÇĞİÖŞÜ])/g, ".\n\n")
    .replace(/\s{2,}(?=[A-ZÇĞİÖŞÜ])/g, "\n\n")
  const segments = normalised.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean)

  function renderSegment(seg: string, i: number) {
    const dashIdx = seg.indexOf(" - ")
    if (dashIdx > 0 && dashIdx < 90) {
      const header = seg.slice(0, dashIdx).trim()
      const body   = seg.slice(dashIdx + 3).trim()
      if (body.length > 5) {
        return (
          <div key={i} className="space-y-1">
            <p className="text-[11px] font-semibold text-violet-700 uppercase tracking-wide">{renderInline(header)}</p>
            <p className="text-sm leading-relaxed text-foreground/85">{renderInline(body)}</p>
          </div>
        )
      }
    }
    return <p key={i} className="text-sm leading-relaxed text-foreground/85">{renderInline(seg)}</p>
  }

  if (segments.length <= 1) return renderSegment(text.trim(), 0)
  return <div className="space-y-4">{segments.map(renderSegment)}</div>
}

// Renders output where **bold text** acts as section/item heading followed by body
function BoldHeadingReport({ text }: { text: string }) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean)

  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        const boldMatch = line.match(/^\*\*(.+?)\*\*[:\s-]*(.*)$/)
        if (boldMatch) {
          const heading = boldMatch[1].trim()
          const rest    = boldMatch[2].trim()
          return (
            <div key={i} className={rest ? "space-y-0.5" : ""}>
              <p className="text-[11px] font-semibold text-violet-700 uppercase tracking-wide">{renderInline(heading)}</p>
              {rest && <p className="text-sm leading-relaxed text-foreground/85">{renderInline(rest)}</p>}
            </div>
          )
        }
        if (/^-\s+/.test(line)) return (
          <p key={i} className="text-sm leading-relaxed text-foreground/85 pl-3 border-l-2 border-violet-200">
            {renderInline(line.replace(/^-\s+/, ""))}
          </p>
        )
        return <p key={i} className="text-sm leading-relaxed text-foreground/85">{renderInline(line)}</p>
      })}
    </div>
  )
}

function SectionedReport({ text, splitPattern, numbered = false }: {
  text: string
  splitPattern: RegExp
  numbered?: boolean
}) {
  const rawSections = text.split(splitPattern).filter(Boolean)
  const sections = rawSections
    .map((section) => {
      const nl      = section.indexOf("\n")
      const rawHead = nl < 0 ? section.trim() : section.slice(0, nl).trim()
      const heading = numbered
        ? rawHead.replace(/^\d+\.\s+/, "").replace(/:$/, "")
        : rawHead.replace(/^##\s*/, "").replace(/:$/, "")
      const body    = nl < 0 ? "" : section.slice(nl + 1).trim()
      const lines   = body.split("\n").map((l) => l.trim()).filter(Boolean)
      return { heading, lines }
    })
    .filter((s) => s.heading.length > 0 && s.lines.length > 0)

  return (
    <div className="space-y-4">
      {sections.map(({ heading, lines }, i) => (
        <div key={i} className="space-y-1.5">
          <p className="text-[11px] font-semibold text-violet-700 uppercase tracking-wide">
            {heading}
          </p>
          <div className="space-y-1">
            {lines.map((line, j) => {
              if (/^-\s+/.test(line)) return (
                <p key={j} className="text-sm leading-relaxed text-foreground/85 pl-3 border-l-2 border-violet-200">
                  {renderInline(line.replace(/^-\s+/, ""))}
                </p>
              )
              if (/^\d+\.\s+/.test(line)) {
                const num  = line.match(/^(\d+)\./)![1]
                const rest = line.replace(/^\d+\.\s+/, "")
                return (
                  <p key={j} className="text-sm leading-relaxed text-foreground/85">
                    <span className="font-semibold text-violet-600 mr-1">{num}.</span>{renderInline(rest)}
                  </p>
                )
              }
              return <p key={j} className="text-sm leading-relaxed text-foreground/85">{renderInline(line)}</p>
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function DocumentCard({ doc }: { doc: DocumentEvent }) {
  const [reportOpen, setReportOpen] = useState(false)
  const [textOpen, setTextOpen]     = useState(false)

  const meta           = doc.metadata
  const attachment     = doc.attachments[0]
  const typeLabel      = meta?.documentType ? (DOCUMENT_TYPE_LABELS[meta.documentType] ?? "Belge") : "Belge"
  const pdfText        = meta?.pdfText ?? ""
  const aiReport       = meta?.aiReport ?? null
  const aiError        = meta?.aiError ?? null
  const extractedValues: LabValue[] = Array.isArray(meta?.extractedValues) ? meta.extractedValues : []

  return (
    <div className="rounded-lg border bg-card overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-start gap-3 p-4">
        <div className="rounded-md bg-purple-50 border border-purple-100 p-2 shrink-0">
          <FileText className="h-5 w-5 text-purple-600" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm truncate">{doc.title}</span>
            <Badge variant="secondary" className="text-xs shrink-0">{typeLabel}</Badge>
            {aiReport && (
              <Badge className="text-xs bg-violet-100 text-violet-700 border-violet-200 shrink-0">
                AI Yorumu Var
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(new Date(doc.date), "d MMM yyyy", { locale: tr })}
            </span>
            {attachment && <span>{formatBytes(attachment.size)}</span>}
            <span>{doc.createdBy.name}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {attachment && (
            <a href={attachment.url} target="_blank" rel="noreferrer">
              <Button variant="ghost" size="icon" className="h-8 w-8" title="PDF Görüntüle">
                <Download className="h-4 w-4" />
              </Button>
            </a>
          )}
        </div>
      </div>

      {/* ── AI Raporu toggle ── */}
      {aiReport && (
        <>
          <div className="border-t">
            <button
              onClick={() => setReportOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-xs hover:bg-muted/30 transition-colors"
            >
              <span className="flex items-center gap-1.5 font-medium text-violet-700">
                <BrainCircuit className="h-3.5 w-3.5" />
                AI Klinik Yorumu
              </span>
              {reportOpen ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>
          </div>

          {reportOpen && (
            <div className="border-t bg-violet-50/40 px-4 py-4 space-y-4">

              {/* Değer tablosu */}
              {extractedValues.length > 0 && (
                <div>
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                    <FlaskConical className="h-3 w-3" />
                    Çıkarılan Değerler
                  </p>
                  <div className="rounded-md border overflow-hidden text-xs">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-muted/60 border-b">
                          <th className="text-left px-3 py-2 font-semibold">Test</th>
                          <th className="text-right px-3 py-2 font-semibold">Sonuç</th>
                          <th className="text-right px-3 py-2 font-semibold hidden sm:table-cell">Referans</th>
                          <th className="text-center px-3 py-2 font-semibold">Durum</th>
                        </tr>
                      </thead>
                      <tbody>
                        {extractedValues.map((v, i) => (
                          <tr key={i} className={cn("border-b last:border-0", STATUS_STYLES[v.status]?.row)}>
                            <td className="px-3 py-1.5 font-medium">{v.name}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums">
                              {v.value} {v.unit}
                            </td>
                            <td className="px-3 py-1.5 text-right text-muted-foreground hidden sm:table-cell">
                              {v.refRange}
                            </td>
                            <td className="px-3 py-1.5 text-center">
                              <span className={cn("inline-block rounded-full px-2 py-0.5 text-[10px]", STATUS_STYLES[v.status]?.badge)}>
                                {STATUS_LABELS[v.status]}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Yazılı yorum */}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                  Klinik Yorum
                </p>
                <AiReportText text={aiReport} />
              </div>
            </div>
          )}
        </>
      )}

      {/* AI yorum yoksa bilgi satırı — MR/beyin analizi belgelerinde gösterilmez. */}
      {!aiReport && meta?.analysisType !== "brain_tumor_segmentation" && (
        <div className="border-t px-4 py-2.5">
          <span className="text-xs text-muted-foreground">
            AI yorumu oluşturulamadı.
            {aiError && (
              <span className="ml-1 text-destructive font-mono">({aiError})</span>
            )}
          </span>
        </div>
      )}

      {/* ── Ham PDF metni (debug) ── */}
      {pdfText && (
        <>
          <div className="border-t">
            <button
              onClick={() => setTextOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-2 text-[11px] text-muted-foreground hover:bg-muted/20 transition-colors"
            >
              <span>Ham PDF Metni ({pdfText.length} karakter)</span>
              {textOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          </div>
          {textOpen && (
            <div className="border-t bg-muted/20 px-4 py-3">
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed max-h-64 overflow-y-auto">
                {pdfText}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  )
}

interface Props {
  initialDocuments: DocumentEvent[]
  patientId: string
}

export function DocumentsSection({ initialDocuments, patientId }: Props) {
  const [documents, setDocuments] = useState<DocumentEvent[]>(initialDocuments)
  const [dialogOpen, setDialogOpen] = useState(false)
  const router = useRouter()

  function handleSuccess(event: DocumentEvent) {
    setDocuments((prev) => [event, ...prev])
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {documents.length === 0
            ? "Henüz belge yüklenmedi"
            : `${documents.length} belge`}
        </p>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Belge Yükle
        </Button>
      </div>

      {documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <FileText className="h-12 w-12 text-muted-foreground/30" />
          <div>
            <p className="font-medium text-sm">Henüz belge yüklenmedi</p>
            <p className="text-xs text-muted-foreground mt-1">
              MR, laboratuvar sonuçları ve diğer belgeleri buraya yükleyin
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <DocumentCard key={doc.id} doc={doc} />
          ))}
        </div>
      )}

      <DocumentUploadDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        patientId={patientId}
        onSuccess={handleSuccess}
      />
    </div>
  )
}
