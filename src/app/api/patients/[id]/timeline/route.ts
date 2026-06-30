import { NextRequest, NextResponse } from "next/server"
import { createTimelineEvent } from "@/lib/db/timeline"
import { prisma } from "@/lib/prisma"
import { z } from "zod/v4"

interface RouteParams {
  params: Promise<{ id: string }>
}

const createEventSchema = z.object({
  type: z.enum(["visit", "diagnosis", "treatment", "note", "document", "prescription", "lab"]),
  title: z.string().min(1),
  description: z.string().min(1),
  date: z.string().datetime(),
  createdById: z.string(),
  metadata: z.record(z.string(), z.string()).optional(),
})

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params
  try {
    const events = await prisma.timelineEvent.findMany({
      where: { patientId: id },
      orderBy: { date: "desc" },
      include: {
        createdBy: { select: { id: true, name: true } },
        attachments: true,
      },
    })
    return NextResponse.json(events)
  } catch {
    return NextResponse.json({ error: "Zaman çizelgesi yüklenemedi" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: patientId } = await params
  try {
    const body = await request.json()
    const validated = createEventSchema.safeParse(body)
    if (!validated.success) {
      return NextResponse.json({ error: validated.error.flatten() }, { status: 400 })
    }
    const event = await createTimelineEvent({
      ...validated.data,
      date: new Date(validated.data.date),
      patientId,
    })
    return NextResponse.json(event, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Kayıt oluşturulamadı" }, { status: 500 })
  }
}
