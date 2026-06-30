import "server-only"
import { prisma } from "@/lib/prisma"
import type { AppointmentStatus, AppointmentType } from "@/generated/prisma/enums"

export async function getAppointments(opts?: {
  status?: AppointmentStatus
  doctorId?: string
  patientId?: string
  from?: Date
  to?: Date
}) {
  const where: {
    status?: AppointmentStatus
    doctorId?: string
    patientId?: string
    scheduledAt?: { gte?: Date; lt?: Date }
  } = {}

  if (opts?.status) where.status = opts.status
  if (opts?.doctorId) where.doctorId = opts.doctorId
  if (opts?.patientId) where.patientId = opts.patientId
  if (opts?.from || opts?.to) {
    where.scheduledAt = {}
    if (opts.from) where.scheduledAt.gte = opts.from
    if (opts.to) where.scheduledAt.lt = opts.to
  }

  return prisma.appointment.findMany({
    where,
    orderBy: { scheduledAt: "asc" },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
      doctor: { select: { id: true, name: true, role: { select: { label: true } } } },
      createdBy: { select: { id: true, name: true } },
    },
  })
}

export async function getAppointmentStats(from: Date, to: Date) {
  const [total, completed, cancelled, scheduled] = await Promise.all([
    prisma.appointment.count({ where: { scheduledAt: { gte: from, lt: to } } }),
    prisma.appointment.count({ where: { scheduledAt: { gte: from, lt: to }, status: "completed" } }),
    prisma.appointment.count({ where: { scheduledAt: { gte: from, lt: to }, status: "cancelled" } }),
    prisma.appointment.count({ where: { scheduledAt: { gte: from, lt: to }, status: "scheduled" } }),
  ])
  return { total, completed, cancelled, scheduled }
}

export async function createAppointmentDb(data: {
  patientId: string
  doctorId: string
  scheduledAt: Date
  duration: number
  type: AppointmentType
  notes?: string
  createdById: string
}) {
  return prisma.appointment.create({ data })
}

export async function updateAppointmentStatusDb(id: string, status: AppointmentStatus) {
  return prisma.appointment.update({ where: { id }, data: { status } })
}
