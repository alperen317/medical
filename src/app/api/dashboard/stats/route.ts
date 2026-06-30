import { NextResponse } from "next/server"
import { getDashboardStats } from "@/lib/db/patients"

export async function GET() {
  try {
    const stats = await getDashboardStats()
    return NextResponse.json(stats)
  } catch {
    return NextResponse.json({ error: "İstatistikler yüklenemedi" }, { status: 500 })
  }
}
