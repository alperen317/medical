import { NextResponse } from "next/server"
import { getOptionalSession } from "@/lib/dal"
import { getNotifications } from "@/lib/db/notifications"

export async function GET() {
  const session = await getOptionalSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const notifications = await getNotifications(session.userId, 20)
    return NextResponse.json({ notifications })
  } catch {
    return NextResponse.json({ error: "Bildirimler yüklenemedi" }, { status: 500 })
  }
}
