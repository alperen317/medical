import { NextResponse } from "next/server"
import { getOptionalSession } from "@/lib/dal"
import { getUnreadCount } from "@/lib/db/notifications"

export async function GET() {
  const session = await getOptionalSession()
  if (!session) return NextResponse.json({ count: 0 })

  try {
    const count = await getUnreadCount(session.userId)
    return NextResponse.json({ count })
  } catch {
    return NextResponse.json({ count: 0 })
  }
}
