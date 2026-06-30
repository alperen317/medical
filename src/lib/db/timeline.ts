import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client"
import type { TimelineEventType } from "@/generated/prisma/enums"

export async function createTimelineEvent(data: {
  patientId: string
  createdById: string
  type: TimelineEventType
  title: string
  description: string
  date: Date
  metadata?: Record<string, string>
}) {
  const { patientId, createdById, ...rest } = data
  return prisma.timelineEvent.create({
    data: {
      ...rest,
      patient: { connect: { id: patientId } },
      createdBy: { connect: { id: createdById } },
    },
    include: {
      createdBy: { select: { id: true, name: true } },
      attachments: true,
    },
  })
}

export async function deleteTimelineEvent(id: string) {
  return prisma.timelineEvent.delete({ where: { id } })
}

export async function createTimelineEventWithAttachment(data: {
  patientId: string
  createdById: string
  type: TimelineEventType
  title: string
  description: string
  date: Date
  metadata?: Prisma.InputJsonValue
  attachment: { name: string; url: string; size: number; type: string }
}) {
  const { patientId, createdById, attachment, metadata, ...rest } = data
  return prisma.timelineEvent.create({
    data: {
      ...rest,
      ...(metadata !== undefined ? { metadata } : {}),
      patient: { connect: { id: patientId } },
      createdBy: { connect: { id: createdById } },
      attachments: { create: [attachment] },
    },
    include: {
      createdBy: { select: { id: true, name: true } },
      attachments: true,
    },
  })
}

export async function getRecentActivity(limit = 20) {
  return prisma.timelineEvent.findMany({
    orderBy: { date: "desc" },
    take: limit,
    include: {
      patient: { select: { id: true, firstName: true, lastName: true } },
      createdBy: { select: { id: true, name: true } },
    },
  })
}

// Type export for external use
export type { Prisma }
