import { NextRequest, NextResponse } from "next/server"
import { getPatientById, updatePatient } from "@/lib/db/patients"
import { Prisma } from "@/generated/prisma/client"

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params
  try {
    const patient = await getPatientById(id)
    if (!patient) return NextResponse.json({ error: "Hasta bulunamadı" }, { status: 404 })
    return NextResponse.json(patient)
  } catch {
    return NextResponse.json({ error: "Hasta yüklenemedi" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  try {
    const body: Prisma.PatientUpdateInput = await request.json()
    const patient = await updatePatient(id, body)
    return NextResponse.json(patient)
  } catch {
    return NextResponse.json({ error: "Hasta güncellenemedi" }, { status: 500 })
  }
}
