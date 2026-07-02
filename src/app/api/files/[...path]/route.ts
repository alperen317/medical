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

  const filename = segments[segments.length - 1]
  const ext = path.extname(filename).toLowerCase()
  const MIME: Record<string, string> = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".json": "application/json",
  }
  const contentType = MIME[ext] ?? "application/octet-stream"

  let blob: Blob
  try {
    const raw = await fs.readFile(filePath)
    blob = new Blob([raw], { type: contentType })
  } catch {
    return NextResponse.json({ error: "Dosya bulunamadı" }, { status: 404 })
  }

  return new NextResponse(blob, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, max-age=3600",
    },
  })
}
