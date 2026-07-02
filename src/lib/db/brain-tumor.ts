import "server-only"

import path from "path"
import fs from "fs/promises"
import { revalidatePath } from "next/cache"
import { logActivity } from "@/lib/db/activity"
import { createTimelineEventWithAttachment } from "@/lib/db/timeline"
import {
  toDataUriViewer,
  type BrainAnalysis,
  type BrainSegmentationResult,
} from "@/lib/ai/brain-tumor"

const UPLOAD_DIR = path.join(process.cwd(), "uploads")

/**
 * Segmentasyon sonucunu kalıcılaştırır: temsili overlay PNG'yi diske yazar,
 * hasta zaman çizelgesine belge event'i ekler ve `/activity` log'una düşer.
 * Hem örnek vaka (Aşama 1) hem de yükleme (Aşama 2) akışları bunu paylaşır.
 *
 * `caseId` null ise sonuç bir yüklemedendir (`source: "upload"`).
 */
export async function persistBrainSegmentation({
  result,
  patientId,
  userId,
  patientName,
  caseId,
}: {
  result: BrainSegmentationResult
  patientId: string
  userId: string
  patientName: string
  caseId: string | null
}): Promise<BrainAnalysis> {
  const source = caseId ? "sample" : "upload"
  const label = caseId ?? "Yüklenen MR"

  // Overlay PNG'yi diske yaz (documents route ile aynı disk deseni).
  const filename = `${Date.now()}-brain-tumor-${caseId ?? "upload"}.png`
  const patientDir = path.join(UPLOAD_DIR, patientId)
  const buffer = Buffer.from(result.overlayPng, "base64")
  await fs.mkdir(patientDir, { recursive: true })
  await fs.writeFile(path.join(patientDir, filename), buffer)
  const fileUrl = `/api/files/${patientId}/${filename}`

  const { tc, wt, et } = result.volumes
  const title = `Beyin MR Tümör Analizi — ${label}`
  const description =
    `MONAI beyin tümörü segmentasyonu (deneysel). ` +
    `Bütün tümör: ${wt} ml, Tümör çekirdeği: ${tc} ml, Kontrastlanan: ${et} ml.`

  await createTimelineEventWithAttachment({
    patientId,
    createdById: userId,
    type: "document",
    title,
    description,
    date: new Date(),
    metadata: JSON.parse(
      JSON.stringify({
        analysisType: "brain_tumor_segmentation",
        source,
        caseId,
        volumes: result.volumes,
        metrics: result.metrics,
        device: result.device,
        elapsedMs: result.elapsedMs,
      }),
    ),
    attachment: {
      name: `${title}.png`,
      url: fileUrl,
      size: buffer.length,
      type: "image/png",
    },
  })

  void logActivity({
    actorId: userId,
    action: "ai.brain_segmentation",
    entityType: "patient",
    entityId: patientId,
    entityLabel: patientName,
    metadata: {
      source,
      caseId,
      volumes: result.volumes,
      metrics: result.metrics,
      device: result.device,
      elapsedMs: result.elapsedMs,
    },
  }).catch(console.error)

  revalidatePath(`/patients/${patientId}`)

  return {
    caseId: label,
    volumes: result.volumes,
    overlayUrl: fileUrl,
    metrics: result.metrics,
    viewer: toDataUriViewer(result.viewer),
    device: result.device,
    elapsedMs: result.elapsedMs,
  }
}
