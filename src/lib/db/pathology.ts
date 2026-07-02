import "server-only"

import path from "path"
import fs from "fs/promises"
import { revalidatePath } from "next/cache"
import { logActivity } from "@/lib/db/activity"
import { createTimelineEventWithAttachment } from "@/lib/db/timeline"
import type { PathologyAnalysis, PathologyDetectionResult } from "@/lib/ai/pathology"

const UPLOAD_DIR = path.join(process.cwd(), "uploads")

/**
 * Tespit sonucunu kalıcılaştırır: ısı haritası + thumbnail PNG'lerini diske
 * yazar, hasta zaman çizelgesine belge event'i ekler ve `/activity` log'una
 * düşer (brain-tumor.ts persistBrainSegmentation ile aynı desen).
 */
export async function persistPathologyDetection({
  result,
  patientId,
  userId,
  patientName,
}: {
  result: PathologyDetectionResult
  patientId: string
  userId: string
  patientName: string
}): Promise<PathologyAnalysis> {
  const ts = Date.now()
  const patientDir = path.join(UPLOAD_DIR, patientId)
  await fs.mkdir(patientDir, { recursive: true })

  const heatmapFilename = `${ts}-pathology-heatmap.png`
  const thumbnailFilename = `${ts}-pathology-thumbnail.png`
  await fs.writeFile(path.join(patientDir, heatmapFilename), Buffer.from(result.heatmapPng, "base64"))
  const thumbnailBuffer = Buffer.from(result.thumbnailPng, "base64")
  await fs.writeFile(path.join(patientDir, thumbnailFilename), thumbnailBuffer)

  const heatmapUrl = `/api/files/${patientId}/${heatmapFilename}`
  const thumbnailUrl = `/api/files/${patientId}/${thumbnailFilename}`

  const { maxProb, tumorAreaPct, patchesAnalyzed } = result.metrics
  const title = `Patoloji Tümör Tespiti — ${result.fileName}`
  const description =
    `MONAI patoloji tümör tespiti (deneysel). ` +
    `Maks. olasılık: %${Math.round(maxProb * 100)}, tümör alanı: %${tumorAreaPct} ` +
    `(${patchesAnalyzed} patch analiz edildi).`

  const event = await createTimelineEventWithAttachment({
    patientId,
    createdById: userId,
    type: "document",
    title,
    description,
    date: new Date(),
    metadata: JSON.parse(
      JSON.stringify({
        analysisType: "pathology_tumor_detection",
        fileName: result.fileName,
        heatmapUrl,
        thumbnailUrl,
        metrics: result.metrics,
        device: result.device,
        elapsedMs: result.elapsedMs,
      }),
    ),
    attachment: {
      name: `${title}.png`,
      url: heatmapUrl,
      size: thumbnailBuffer.length,
      type: "image/png",
    },
  })

  void logActivity({
    actorId: userId,
    action: "ai.pathology_detection",
    entityType: "patient",
    entityId: patientId,
    entityLabel: patientName,
    metadata: {
      fileName: result.fileName,
      metrics: result.metrics,
      device: result.device,
      elapsedMs: result.elapsedMs,
    },
  }).catch(console.error)

  revalidatePath(`/patients/${patientId}`)

  return {
    id: event.id,
    date: event.date.toISOString(),
    fileName: result.fileName,
    heatmapUrl,
    thumbnailUrl,
    metrics: result.metrics,
    device: result.device,
    elapsedMs: result.elapsedMs,
  }
}
