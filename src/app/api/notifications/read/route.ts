import { NextRequest, NextResponse } from "next/server"
import { getOptionalSession } from "@/lib/dal"
import { markAllAsRead, markAsRead } from "@/lib/db/notifications"

export async function PATCH(request: NextRequest) {
  const session = await getOptionalSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await request.json().catch(() => ({}))
    if (body.id) {
      await markAsRead(body.id, session.userId)
    } else {
      await markAllAsRead(session.userId)
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Güncelleme başarısız" }, { status: 500 })
  }
}
