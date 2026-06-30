import { NextRequest, NextResponse } from "next/server"
import path from "path"
import fs from "fs/promises"
import { getOptionalSession } from "@/lib/dal"

interface RouteParams {
  params: Promise<{ path: string[] }>
}

const UPLOAD_DIR = path.join(process.cwd(), "uploads")

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await getOptionalSession()
  if (!session) return NextResponse.json({ error: "Oturum açmanız gerekiyor" }, { status: 401 })

  const { path: segments } = await params
  // segments: [patientId, filename]
  if (segments.length < 2) return NextResponse.json({ error: "Geçersiz dosya yolu" }, { status: 400 })

  // Prevent path traversal
  const filePath = path.join(UPLOAD_DIR, ...segments)
  if (!filePath.startsWith(UPLOAD_DIR)) {
    return NextResponse.json({ error: "Geçersiz dosya yolu" }, { status: 400 })
  }

  let blob: Blob
  try {
    const raw = await fs.readFile(filePath)
    blob = new Blob([raw], { type: "application/pdf" })
  } catch {
    return NextResponse.json({ error: "Dosya bulunamadı" }, { status: 404 })
  }

  const filename = segments[segments.length - 1]
  return new NextResponse(blob, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, max-age=3600",
    },
  })
}
