"use client"

import { useState } from "react"
import { FileText, FlaskConical, BrainCircuit } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { AiReportText } from "@/components/documents/documents-section"

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
        Raporu Görüntüle
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
