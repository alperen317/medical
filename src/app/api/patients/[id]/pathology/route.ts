import { NextRequest, NextResponse } from "next/server"
import { getOptionalSession } from "@/lib/dal"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { runPathologyDetectionUpload } from "@/lib/ai/pathology"
import { persistPathologyDetection } from "@/lib/db/pathology"

interface RouteParams {
  params: Promise<{ id: string }>
}

// WSI dosyaları GB mertebesinde olabilir (beyin MR'daki 60 MB NIfTI limitinden çok farklı).
// NOT: Önünde bir reverse proxy varsa (nginx vb.) `client_max_body_size`'ı da
// buna göre artırmayı unutmayın — aksi halde proxy daha küçük bir limitte keser.
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024
const ALLOWED_EXTENSIONS = /\.(tif|tiff|svs|ndpi)$/i

/**
 * Kullanıcının yüklediği bir whole-slide image (WSI) üzerinde MONAI
 * `pathology_tumor_detection` bundle'ı ile tümör tespiti çalıştırır. Sonuç
 * (ısı haritası + metrikler) diske + zaman çizelgesine + aktivite log'una
 * kalıcılaştırılır. `document:upload` yetkisi gerekir (brain-tumor route'u
 * ile aynı yetki, yeni izin eklenmiyor).
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await getOptionalSession()
  if (!session) return NextResponse.json({ error: "Oturum açmanız gerekiyor" }, { status: 401 })
  if (!can(session.permissions, "document:upload"))
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 })

  const { id: patientId } = await params

  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { firstName: true, lastName: true },
  })
  if (!patient) return NextResponse.json({ error: "Hasta bulunamadı" }, { status: 404 })

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: "Form verisi okunamadı" }, { status: 400 })
  }

  const file = formData.get("file")
  if (!(file instanceof File))
    return NextResponse.json({ error: "WSI dosyası eksik" }, { status: 400 })
  if (!ALLOWED_EXTENSIONS.test(file.name))
    return NextResponse.json(
      { error: "Dosya bir WSI (.tif/.tiff/.svs/.ndpi) olmalı" },
      { status: 400 },
    )
  if (file.size > MAX_FILE_SIZE)
    return NextResponse.json({ error: "Dosya 2 GB'den büyük olamaz" }, { status: 413 })

  let result
  try {
    result = await runPathologyDetectionUpload(file)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    )
  }

  const analysis = await persistPathologyDetection({
    result,
    patientId,
    userId: session.userId,
    patientName: `${patient.firstName} ${patient.lastName}`,
  })

  return NextResponse.json({ analysis }, { status: 201 })
}
