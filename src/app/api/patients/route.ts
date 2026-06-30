import { NextRequest, NextResponse } from "next/server"
import { getPatients, type PatientSort } from "@/lib/db/patients"
import type { PatientStatus } from "@/generated/prisma/enums"

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const search = searchParams.get("search") ?? undefined
  const status = (searchParams.get("status") as PatientStatus) || undefined
  const sort = (searchParams.get("sort") as PatientSort) || undefined
  const page = Number(searchParams.get("page") ?? 1)
  const limit = Number(searchParams.get("limit") ?? 50)

  try {
    const result = await getPatients({ search, status, sort, page, limit })
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: "Hastalar yüklenemedi" }, { status: 500 })
  }
}
