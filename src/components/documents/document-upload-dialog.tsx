"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle, ArrowLeft, ScanText } from "lucide-react"
import { cn } from "@/lib/utils"
import type { DocumentEvent } from "./documents-section"

const DOCUMENT_TYPES = [
  { value: "biyokimya",   label: "Biyokimya Raporu" },
  { value: "tam_kan",     label: "Tam Kan Sayımı" },
  { value: "lipid",       label: "Lipid Paneli" },
  { value: "tiroid",      label: "Tiroid Paneli" },
  { value: "idrar",       label: "İdrar Tahlili" },
  { value: "hormon",      label: "Hormon Paneli" },
  { value: "goruntuleme", label: "Görüntüleme Raporu" },
  { value: "diger",       label: "Diğer" },
]

type Step = "form" | "review"
type Status = "idle" | "extracting" | "uploading" | "success" | "error"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  patientId: string
  onSuccess: (event: DocumentEvent) => void
}

export function DocumentUploadDialog({ open, onOpenChange, patientId, onSuccess }: Props) {
  const [documentType, setDocumentType] = useState("biyokimya")
  const [title, setTitle] = useState("Biyokimya Raporu")
  const [file, setFile] = useState<File | null>(null)
  const [step, setStep] = useState<Step>("form")
  const [pdfText, setPdfText] = useState("")
  const [status, setStatus] = useState<Status>("idle")
  const [errorMsg, setErrorMsg] = useState("")
  const [dragOver, setDragOver] = useState(false)
  const [fileUrl, setFileUrl] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isPending = status === "extracting" || status === "uploading"

  // PDF önizlemesi için seçilen dosyadan blob URL üret; dosya değişince/temizlenince geri al.
  useEffect(() => {
    if (!file) { setFileUrl(""); return }
    const url = URL.createObjectURL(file)
    setFileUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function resetAll() {
    setFile(null)
    setStep("form")
    setPdfText("")
    setStatus("idle")
    setErrorMsg("")
    setDocumentType("biyokimya")
    setTitle("Biyokimya Raporu")
  }

  function handleTypeChange(value: string) {
    setDocumentType(value)
    const found = DOCUMENT_TYPES.find((t) => t.value === value)
    if (found) setTitle(found.label)
  }

  function handleFile(f: File) {
    if (f.type !== "application/pdf") {
      setErrorMsg("Yalnızca PDF dosyası yüklenebilir.")
      return
    }
    if (f.size > 10 * 1024 * 1024) {
      setErrorMsg("Dosya 10 MB'den büyük olamaz.")
      return
    }
    setErrorMsg("")
    setFile(f)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  // Adım 1: PDF metnini çıkar (AI yok, kayıt yok) ve onaya sun.
  async function handleExtract(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !title.trim()) return

    setStatus("extracting")
    setErrorMsg("")

    const formData = new FormData()
    formData.append("file", file)

    try {
      const res = await fetch(`/api/patients/${patientId}/documents/extract`, {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error ?? "Metin çıkarılamadı.")
        setStatus("error")
        return
      }
      setPdfText(typeof data.pdfText === "string" ? data.pdfText : "")
      setStep("review")
      setStatus("idle")
    } catch {
      setErrorMsg("Sunucuya bağlanılamadı.")
      setStatus("error")
    }
  }

  // Adım 2: Onaylanan metni analize gönder ve belgeyi kaydet.
  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !title.trim()) return

    setStatus("uploading")
    setErrorMsg("")

    const formData = new FormData()
    formData.append("file", file)
    formData.append("title", title.trim())
    formData.append("documentType", documentType)
    formData.append("pdfText", pdfText)

    try {
      const res = await fetch(`/api/patients/${patientId}/documents`, {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error ?? "Yükleme başarısız oldu.")
        setStatus("error")
        return
      }

      setStatus("success")
      onSuccess(data.event as DocumentEvent)

      setTimeout(() => {
        onOpenChange(false)
        resetAll()
      }, 1200)
    } catch {
      setErrorMsg("Sunucuya bağlanılamadı.")
      setStatus("error")
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isPending) { onOpenChange(v); if (!v) resetAll() } }}>
      <DialogContent
        className={cn(
          "flex flex-col p-0 gap-0 overflow-hidden transition-[max-width]",
          step === "form" ? "max-w-md" : "max-w-6xl w-[96vw] h-[90vh]",
        )}
      >
        <div className="h-0.75 w-full bg-purple-500 shrink-0" />

        <div className="px-6 pt-5 pb-3 shrink-0">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {step === "form" ? "Belge Yükle" : "Metni Onayla"}
            </DialogTitle>
            <DialogDescription className="text-xs mt-1">
              {step === "form"
                ? "PDF formatında tıbbi belge yükleyin — sistem metni otomatik çıkarır."
                : "Analize gönderilecek metni kontrol edin ve gerekirse düzeltin."}
            </DialogDescription>
          </DialogHeader>
        </div>

        <Separator />

        {step === "form" ? (
          <form onSubmit={handleExtract} className="flex flex-col gap-5 px-6 py-5">
            {/* Document type */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                Belge Türü <span className="text-destructive">*</span>
              </label>
              <select
                value={documentType}
                onChange={(e) => handleTypeChange(e.target.value)}
                disabled={isPending}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
              >
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                Başlık <span className="text-destructive">*</span>
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Belge başlığı..."
                disabled={isPending}
              />
            </div>

            {/* File drop zone */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                PDF Dosyası <span className="text-destructive">*</span>
              </label>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => !isPending && fileInputRef.current?.click()}
                className={cn(
                  "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed py-8 text-sm transition-colors cursor-pointer",
                  dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/40",
                  isPending && "pointer-events-none opacity-50",
                  file && !isPending && "border-green-400 dark:border-green-700 bg-green-50 dark:bg-green-950/40",
                )}
              >
                {file ? (
                  <>
                    <FileText className="h-8 w-8 text-green-600 dark:text-green-400" />
                    <span className="font-medium text-green-700 dark:text-green-400 text-xs text-center px-4 break-all">{file.name}</span>
                    <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-muted-foreground/60" />
                    <span className="text-muted-foreground">PDF sürükleyin veya <span className="text-primary font-medium">seçin</span></span>
                    <span className="text-xs text-muted-foreground">Maks. 10 MB</span>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              />
            </div>

            {/* Error */}
            {errorMsg && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {errorMsg}
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={isPending}>
                İptal
              </Button>
              <Button type="submit" size="sm" disabled={isPending || !file || !title.trim()} className="gap-2 min-w-36">
                {status === "extracting"
                  ? <><Loader2 className="h-4 w-4 animate-spin" />Metin çıkarılıyor...</>
                  : <><ScanText className="h-4 w-4" />Metni Çıkar</>}
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleConfirm} className="flex flex-1 min-h-0 flex-col">
            {/* İki kolon: sol PDF önizleme, sağ çıkarılan metin */}
            <div className="grid flex-1 min-h-0 grid-cols-1 gap-0 md:grid-cols-2">
              {/* Sol — PDF */}
              <div className="flex min-w-0 flex-col border-b md:border-b-0 md:border-r">
                <div className="flex items-center gap-2 px-5 py-2 shrink-0">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest truncate">
                    {file?.name ?? "PDF"}
                  </span>
                </div>
                <div className="flex-1 min-h-0 bg-muted/30">
                  {fileUrl ? (
                    <iframe src={`${fileUrl}#toolbar=1&view=FitH`} title="PDF önizleme" className="h-full w-full border-0" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                      PDF önizlenemiyor
                    </div>
                  )}
                </div>
              </div>

              {/* Sağ — çıkarılan metin */}
              <div className="flex min-w-0 flex-col">
                <div className="flex items-center justify-between px-5 py-2 shrink-0">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                    Çıkarılan Metin
                  </span>
                  <span className="text-[10px] text-muted-foreground">{pdfText.trim().length} karakter</span>
                </div>
                <div className="flex flex-1 min-h-0 flex-col gap-3 px-5 pb-3">
                  <textarea
                    value={pdfText}
                    onChange={(e) => setPdfText(e.target.value)}
                    disabled={isPending}
                    spellCheck={false}
                    placeholder="PDF'ten metin çıkarılamadı. Analiz edilecek metni buraya elle girebilir veya boş bırakıp yalnızca dosyayı kaydedebilirsiniz."
                    className="flex-1 min-h-0 w-full rounded-md border border-input bg-background px-3 py-2 text-xs leading-relaxed font-mono shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 resize-none whitespace-pre-wrap"
                  />
                  {pdfText.trim().length === 0 && (
                    <div className="flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-400 shrink-0">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>PDF&apos;ten metin çıkarılamadı (taranmış/görüntü olabilir). Boş onaylarsanız AI analizi yapılmaz, yalnızca dosya kaydedilir.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 px-6 py-3 shrink-0">
              {errorMsg ? (
                <div className="flex items-center gap-2 text-sm text-destructive min-w-0">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span className="truncate">{errorMsg}</span>
                </div>
              ) : <span />}
              <div className="flex items-center gap-2 shrink-0">
                <Button type="button" variant="ghost" size="sm" onClick={() => { setStep("form"); setStatus("idle"); setErrorMsg("") }} disabled={isPending} className="gap-1.5">
                  <ArrowLeft className="h-4 w-4" />Geri
                </Button>
                <Button type="submit" size="sm" disabled={isPending} className="gap-2 min-w-44">
                  {status === "uploading" && <><Loader2 className="h-4 w-4 animate-spin" />Analiz ediliyor...</>}
                  {status === "success"   && <><CheckCircle2 className="h-4 w-4" />Kaydedildi!</>}
                  {(status === "idle" || status === "error") && <><CheckCircle2 className="h-4 w-4" />Onayla ve Analiz Et</>}
                </Button>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
