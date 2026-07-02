import { NextResponse } from "next/server"
import { getOptionalSession } from "@/lib/dal"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/db/activity"

export const dynamic = "force-dynamic"

/**
 * AI geri bildirim verisini eğitime hazır JSONL olarak dışa aktarır (chat formatı).
 *
 * ANONİM: hasta/kullanıcı kimlikleri (patientId, ratedById) ve isim gibi hiçbir
 * bağlantı dışa aktarılmaz — yalnızca mesajlar, puan, nedenler ve model. `settings:manage`
 * yetkisi gerekir.
 *
 * Her satır: { messages:[system,user,assistant], rating, corrected, reasons, model }
 * assistant içeriği = düzeltilmiş çıktı (varsa) yoksa modelin sonucu.
 */
export async function GET() {
  const session = await getOptionalSession()
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  if (!can(session.permissions, "settings:manage")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const rows = await prisma.aiReportRating.findMany({
    orderBy: { createdAt: "asc" },
    // Kimlik bağlantılarını (patientId, ratedById) BİLEREK seçmiyoruz — anonim çıktı.
    select: {
      source: true,
      systemPrompt: true,
      prompt: true,
      result: true,
      correctedResult: true,
      rating: true,
      reasons: true,
      model: true,
      createdAt: true,
    },
  })

  const jsonl = rows
    .map((r) =>
      JSON.stringify({
        messages: [
          ...(r.systemPrompt ? [{ role: "system", content: r.systemPrompt }] : []),
          { role: "user", content: r.prompt },
          { role: "assistant", content: r.correctedResult || r.result },
        ],
        rating: r.rating,
        corrected: Boolean(r.correctedResult),
        reasons: r.reasons,
        model: r.model,
        source: r.source,
        createdAt: r.createdAt.toISOString(),
      }),
    )
    .join("\n")

  void logActivity({
    actorId: session.userId,
    action: "ai.ratings_exported",
    entityType: "ai_rating",
    metadata: { count: rows.length },
  }).catch(console.error)

  return new NextResponse(jsonl, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Content-Disposition": `attachment; filename="ai-ratings-${new Date().toISOString().slice(0, 10)}.jsonl"`,
    },
  })
}
