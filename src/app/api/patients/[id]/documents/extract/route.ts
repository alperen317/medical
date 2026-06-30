import { NextRequest, NextResponse } from "next/server"
import { getOptionalSession } from "@/lib/dal"
import { can } from "@/lib/permissions"
import { extractTextFromPDF, cleanMedicalReportText } from "@/lib/pdf-parser"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

// PDF metnini çıkarır ve temizler — dosyayı diske yazmaz, AI çalıştırmaz,
// kayıt oluşturmaz. Kullanıcı metni onaylamadan önce önizleme amaçlıdır.
export async function POST(request: NextRequest) {
  const session = await getOptionalSession()
  if (!session) return NextResponse.json({ error: "Oturum açmanız gerekiyor" }, { status: 401 })
  if (!can(session.permissions, "document:upload"))
    return NextResponse.json({ error: "Belge yükleme yetkiniz yok" }, { status: 403 })

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: "Form verisi okunamadı" }, { status: 400 })
  }

  const file = formData.get("file")
  if (!(file instanceof File)) return NextResponse.json({ error: "Dosya bulunamadı" }, { status: 400 })
  if (file.type !== "application/pdf") return NextResponse.json({ error: "Yalnızca PDF dosyası yüklenebilir" }, { status: 400 })
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "Dosya 10 MB'den büyük olamaz" }, { status: 413 })

  const buffer = Buffer.from(await file.arrayBuffer())

  let pdfText = ""
  try {
    const parsed = await extractTextFromPDF(buffer)
    pdfText = cleanMedicalReportText(parsed.text)
  } catch {
    // non-fatal — taranmış/görüntü PDF'lerde metin çıkmayabilir
  }

  return NextResponse.json({ pdfText })
}
