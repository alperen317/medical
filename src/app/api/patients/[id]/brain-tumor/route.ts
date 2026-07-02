import { NextRequest, NextResponse } from "next/server"
import { getOptionalSession } from "@/lib/dal"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { runBrainSegmentationUpload } from "@/lib/ai/brain-tumor"
import { persistBrainSegmentation } from "@/lib/db/brain-tumor"

interface RouteParams {
  params: Promise<{ id: string }>
}

// Tek modalite NIfTI'ler büyük olabilir (sıkıştırılmamış ~35 MB).
const MAX_FILE_SIZE = 60 * 1024 * 1024
const MODALITIES = ["flair", "t1", "t1c", "t2"] as const

/**
 * Aşama 2 — kullanıcının yüklediği 4 ko-registre modalite NIfTI (FLAIR/T1/T1c/T2)
 * üzerinde beyin tümörü segmentasyonu çalıştırır. Sonuç örnek-vaka akışıyla aynı
 * şekilde diske + zaman çizelgesine + aktivite log'una kalıcılaştırılır.
 * `document:upload` yetkisi gerekir.
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

  const files = {} as Record<(typeof MODALITIES)[number], File>
  for (const key of MODALITIES) {
    const f = formData.get(key)
    if (!(f instanceof File))
      return NextResponse.json({ error: `${key.toUpperCase()} dosyası eksik` }, { status: 400 })
    if (!/\.nii(\.gz)?$/i.test(f.name))
      return NextResponse.json({ error: `${key.toUpperCase()} bir NIfTI (.nii/.nii.gz) olmalı` }, { status: 400 })
    if (f.size > MAX_FILE_SIZE)
      return NextResponse.json({ error: `${key.toUpperCase()} 60 MB'den büyük olamaz` }, { status: 413 })
    files[key] = f
  }

  let result
  try {
    result = await runBrainSegmentationUpload({
      flair: files.flair,
      t1: files.t1,
      t1c: files.t1c,
      t2: files.t2,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    )
  }

  const analysis = await persistBrainSegmentation({
    result,
    patientId,
    userId: session.userId,
    patientName: `${patient.firstName} ${patient.lastName}`,
    caseId: null,
  })

  return NextResponse.json({ analysis }, { status: 201 })
}
