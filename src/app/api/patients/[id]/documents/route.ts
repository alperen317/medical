import { NextRequest, NextResponse } from "next/server"
import path from "path"
import fs from "fs/promises"
import { getOptionalSession } from "@/lib/dal"
import { can } from "@/lib/permissions"
import { extractTextFromPDF, cleanMedicalReportText } from "@/lib/pdf-parser"
import { interpretLabReport } from "@/lib/ai/lab-report"
import { createTimelineEventWithAttachment } from "@/lib/db/timeline"
import { logActivity } from "@/lib/db/activity"

interface RouteParams {
  params: Promise<{ id: string }>
}

const UPLOAD_DIR = path.join(process.cwd(), "uploads")
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  biyokimya:   "Biyokimya Raporu",
  tam_kan:     "Tam Kan Sayımı",
  lipid:       "Lipid Paneli",
  tiroid:      "Tiroid Paneli",
  idrar:       "İdrar Tahlili",
  hormon:      "Hormon Paneli",
  goruntuleme: "Görüntüleme Raporu",
  diger:       "Belge",
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await getOptionalSession()
  if (!session) return NextResponse.json({ error: "Oturum açmanız gerekiyor" }, { status: 401 })
  if (!can(session.permissions, "document:upload"))
    return NextResponse.json({ error: "Belge yükleme yetkiniz yok" }, { status: 403 })

  const { id: patientId } = await params

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: "Form verisi okunamadı" }, { status: 400 })
  }

  const file = formData.get("file")
  const title = formData.get("title")?.toString().trim()
  const documentType = formData.get("documentType")?.toString() ?? "diger"
  // Kullanıcının önizleme adımında onayladığı/düzenlediği metin.
  const confirmedTextRaw = formData.get("pdfText")
  const confirmedText = typeof confirmedTextRaw === "string" ? confirmedTextRaw : null

  if (!(file instanceof File)) return NextResponse.json({ error: "Dosya bulunamadı" }, { status: 400 })
  if (!title) return NextResponse.json({ error: "Başlık zorunludur" }, { status: 400 })
  if (file.type !== "application/pdf") return NextResponse.json({ error: "Yalnızca PDF dosyası yüklenebilir" }, { status: 400 })
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "Dosya 10 MB'den büyük olamaz" }, { status: 413 })

  // 1. Save file to disk
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const timestamp = Date.now()
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")
  const filename = `${timestamp}-${safeName}`
  const patientDir = path.join(UPLOAD_DIR, patientId)

  await fs.mkdir(patientDir, { recursive: true })
  await fs.writeFile(path.join(patientDir, filename), buffer)

  // 2. PDF metni: kullanıcı önizlemede onayladıysa onu kullan (tek doğruluk
  //    kaynağı budur). Onaylanmış metin gelmediyse — geriye dönük uyumluluk
  //    için — sunucu tarafında tekrar çıkar.
  let pdfText = ""
  if (confirmedText !== null) {
    pdfText = confirmedText.trim()
  } else {
    try {
      const parsed = await extractTextFromPDF(buffer)
      pdfText = cleanMedicalReportText(parsed.text)
    } catch {
      // non-fatal
    }
  }

  // 3. AI interpretation (non-fatal if fails)
  let aiReport: string | null = null
  let extractedValues: unknown = null
  let aiError: string | null = null

  if (pdfText) {
    try {
      const result = await interpretLabReport(pdfText, DOCUMENT_TYPE_LABELS[documentType] ?? documentType)
      aiReport = result.aiReport
      extractedValues = result.extractedValues
    } catch (err) {
      aiError = err instanceof Error ? err.message : String(err)
      console.error("AI yorum hatası:", aiError)
    }
  }

  const fileUrl = `/api/files/${patientId}/${filename}`
  const typeLabel = DOCUMENT_TYPE_LABELS[documentType] ?? "Belge"

  // 4. Save to DB
  const event = await createTimelineEventWithAttachment({
    patientId,
    createdById: session.userId,
    type: "document",
    title,
    description: aiReport
      ? aiReport.slice(0, 300)
      : pdfText
        ? `${typeLabel} yüklendi. PDF metni çıkarıldı.`
        : `${typeLabel} yüklendi.`,
    date: new Date(),
    metadata: JSON.parse(JSON.stringify({
      documentType,
      pdfText: pdfText.slice(0, 8000),
      aiReport,
      extractedValues: extractedValues ?? null,
      aiError,
    })),
    attachment: {
      name: file.name,
      url: fileUrl,
      size: file.size,
      type: file.type,
    },
  })

  void logActivity({
    actorId: session.userId,
    action: "document.upload",
    entityType: "document",
    entityId: event.id,
    entityLabel: title,
    metadata: {
      patientId,
      documentType,
      fileName: file.name,
      textConfirmed: confirmedText !== null,
      aiAnalyzed: aiReport !== null,
    },
  }).catch(console.error)

  return NextResponse.json({ event }, { status: 201 })
}
