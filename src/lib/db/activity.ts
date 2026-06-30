import { prisma } from "@/lib/prisma"
import type { Prisma } from "@/generated/prisma/client"

export async function logActivity(data: {
  actorId?: string
  action: string
  entityType: string
  entityId?: string
  entityLabel?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>
}) {
  return prisma.activityLog.create({
    data: {
      actorId: data.actorId ?? null,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId ?? null,
      entityLabel: data.entityLabel ?? null,
      ...(data.metadata !== undefined ? { metadata: data.metadata as Prisma.InputJsonValue } : {}),
    },
  })
}

export async function getActivityLogs(opts?: {
  page?: number
  limit?: number
  entityType?: string
}) {
  const page = opts?.page ?? 1
  const limit = opts?.limit ?? 50
  const skip = (page - 1) * limit

  const where = opts?.entityType && opts.entityType !== "all"
    ? { entityType: opts.entityType }
    : undefined

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            role: { select: { label: true } },
          },
        },
      },
    }),
    prisma.activityLog.count({ where }),
  ])

  return { logs, total, page, limit, totalPages: Math.ceil(total / limit) }
}
