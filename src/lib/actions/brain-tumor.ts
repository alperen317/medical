"use server"

import { verifySession } from "@/lib/dal"
import { can } from "@/lib/permissions"
import { readBrainAnalysis } from "@/lib/db/brain-tumor"
import type { BrainAnalysis } from "@/lib/ai/brain-tumor"

export type GetBrainAnalysisResult =
  | { success: true; analysis: BrainAnalysis }
  | { success: false; message: string }

/**
 * Diske kaydedilmiş bir geçmiş analizi (tam interaktif görüntüleyici) yükler.
 * `document:read` yetkisi gerekir.
 */
export async function getBrainAnalysisAction(
  patientId: string,
  file: string,
): Promise<GetBrainAnalysisResult> {
  const user = await verifySession()
  if (!can(user.permissions, "document:read")) {
    return { success: false, message: "Bu işlem için yetkiniz yok." }
  }
  try {
    const analysis = await readBrainAnalysis(patientId, file)
    return { success: true, analysis }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : String(err) }
  }
}
