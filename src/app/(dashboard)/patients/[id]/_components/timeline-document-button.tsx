"use client"

import { useState } from "react"
import { FileText, FlaskConical, BrainCircuit } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

interface LabValue {
  name: string
  value: string
  unit: string
  refRange: string
  status: "normal" | "high" | "low" | "critical"
}

interface DocMeta {
  aiReport?: string | null
  extractedValues?: LabValue[] | null
}

interface Props {
  fileName: string
  fileUrl: string
  title: string
  meta: DocMeta | null
}

const STATUS_STYLES: Record<LabValue["status"], { badge: string; row: string }> = {
  normal:   { badge: "bg-green-100 text-green-700",       row: "" },
  high:     { badge: "bg-red-100 text-red-700",           row: "bg-red-50/50" },
  low:      { badge: "bg-blue-100 text-blue-700",         row: "bg-blue-50/50" },
  critical: { badge: "bg-red-200 text-red-800 font-bold", row: "bg-red-100/60" },
}

const STATUS_LABELS: Record<LabValue["status"], string> = {
  normal: "Normal", high: "Yüksek", low: "Düşük", critical: "Kritik",
}

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
              <p className="text-[11px] font-semibold text-violet-700 uppercase tracking-wide">{heading}</p>
              {rest && <p className="text-sm leading-relaxed text-foreground/85">{rest}</p>}
            </div>
          )
        }
        if (/^-\s+/.test(line)) return (
          <p key={i} className="text-sm leading-relaxed text-foreground/85 pl-3 border-l-2 border-violet-200">
            {line.replace(/^-\s+/, "")}
          </p>
        )
        return <p key={i} className="text-sm leading-relaxed text-foreground/85">{line}</p>
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
                  {line.replace(/^-\s+/, "")}
                </p>
              )
              if (/^\d+\.\s+/.test(line)) {
                const num  = line.match(/^(\d+)\./)![1]
                const rest = line.replace(/^\d+\.\s+/, "")
                return (
                  <p key={j} className="text-sm leading-relaxed text-foreground/85">
                    <span className="font-semibold text-violet-600 mr-1">{num}.</span>{rest}
                  </p>
                )
              }
              return <p key={j} className="text-sm leading-relaxed text-foreground/85">{line}</p>
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function AiReportText({ text }: { text: string }) {
  if (/^##\s+/m.test(text)) {
    return <SectionedReport text={text} splitPattern={/^##\s+/m} />
  }

  if (/^\d+\.\s+[A-ZÇĞİÖŞÜ]/m.test(text)) {
    return <SectionedReport text={text} splitPattern={/(?=^\d+\.\s+)/m} numbered />
  }

  if (/^\*\*[^*]+\*\*/m.test(text)) {
    return <BoldHeadingReport text={text} />
  }

  // Legacy format: "Header - body" separated by double newlines
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
            <p className="text-[11px] font-semibold text-violet-700 uppercase tracking-wide">{header}</p>
            <p className="text-sm leading-relaxed text-foreground/85">{body}</p>
          </div>
        )
      }
    }
    return <p key={i} className="text-sm leading-relaxed text-foreground/85">{seg}</p>
  }

  if (segments.length <= 1) return renderSegment(text.trim(), 0)
  return <div className="space-y-4">{segments.map(renderSegment)}</div>
}

export function TimelineDocumentButton({ fileName, fileUrl, title, meta }: Props) {
  const [open, setOpen] = useState(false)

  const aiReport        = meta?.aiReport ?? null
  const extractedValues: LabValue[] = Array.isArray(meta?.extractedValues) ? meta.extractedValues : []

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md border bg-background/60 px-2 py-1 text-xs hover:bg-background transition-colors"
      >
        <FileText className="h-3 w-3" />
        {fileName}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl w-[95vw] h-[92vh] flex flex-col gap-0 p-0">
          <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-orange-600" />
              {title}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="rapor" className="flex flex-col flex-1 min-h-0">
            <TabsList className="mx-6 mt-3 w-fit shrink-0">
              <TabsTrigger value="rapor">AI Raporu</TabsTrigger>
              <TabsTrigger value="pdf">PDF Görüntüle</TabsTrigger>
            </TabsList>

            {/* ── Tab 1: AI Raporu ── */}
            <TabsContent value="rapor" className="flex-1 overflow-y-auto px-6 pb-6 mt-4 space-y-5">
              {aiReport && (
                <div>
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                    <BrainCircuit className="h-3 w-3" />
                    AI Klinik Yorumu
                  </p>
                  <div className="rounded-md border border-violet-100 bg-violet-50/40 px-4 py-3">
                    <AiReportText text={aiReport} />
                  </div>
                </div>
              )}

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

              {!aiReport && extractedValues.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Bu belge için rapor bilgisi bulunamadı.
                </p>
              )}
            </TabsContent>

            {/* ── Tab 2: PDF Görüntüle ── */}
            <TabsContent value="pdf" className="flex-1 min-h-0 px-6 pb-6 mt-4">
              <iframe
                src={fileUrl}
                className="w-full h-full rounded-md border"
                title={fileName}
              />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  )
}
