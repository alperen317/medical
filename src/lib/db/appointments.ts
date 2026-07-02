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
  const [total, completed, cancelled, scheduled, noShow] = await Promise.all([
    prisma.appointment.count({ where: { scheduledAt: { gte: from, lt: to } } }),
    prisma.appointment.count({ where: { scheduledAt: { gte: from, lt: to }, status: "completed" } }),
    prisma.appointment.count({ where: { scheduledAt: { gte: from, lt: to }, status: "cancelled" } }),
    prisma.appointment.count({ where: { scheduledAt: { gte: from, lt: to }, status: "scheduled" } }),
    prisma.appointment.count({ where: { scheduledAt: { gte: from, lt: to }, status: "no_show" } }),
  ])
  return { total, completed, cancelled, scheduled, noShow }
}

/**
 * Aynı doktorun çakışan bir randevusu var mı kontrol eder.
 * İptal edilmiş randevular çakışma sayılmaz. `excludeId` düzenleme senaryosu içindir.
 * İki randevu [start, start+duration) aralıkları kesişiyorsa çakışır.
 */
export async function findConflictingAppointment(opts: {
  doctorId: string
  scheduledAt: Date
  duration: number
  excludeId?: string
}) {
  const newStart = opts.scheduledAt.getTime()
  const newEnd = newStart + opts.duration * 60_000

  // Aynı gün içindeki (± 1 gün pencere) aday randevuları çek, kesişimi JS'te hesapla —
  // duration bitiş zamanı olarak saklanmadığı için SQL'de aralık kesişimi kurmak zor.
  const dayStart = new Date(newStart - 24 * 60 * 60_000)
  const dayEnd = new Date(newEnd + 24 * 60 * 60_000)

  const candidates = await prisma.appointment.findMany({
    where: {
      doctorId: opts.doctorId,
      status: { in: ["scheduled", "completed"] },
      scheduledAt: { gte: dayStart, lt: dayEnd },
      ...(opts.excludeId ? { id: { not: opts.excludeId } } : {}),
    },
    include: {
      patient: { select: { firstName: true, lastName: true } },
    },
  })

  for (const c of candidates) {
    const cStart = new Date(c.scheduledAt).getTime()
    const cEnd = cStart + c.duration * 60_000
    if (newStart < cEnd && cStart < newEnd) return c
  }
  return null
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

/**
 * Hatırlatması gönderilmesi gereken randevular:
 * [now, now+windowHours] aralığında, durumu "scheduled" ve henüz hatırlatma gönderilmemiş.
 */
export async function getDueReminders(now: Date, windowHours: number) {
  const until = new Date(now.getTime() + windowHours * 60 * 60_000)
  return prisma.appointment.findMany({
    where: {
      status: "scheduled",
      reminderSentAt: null,
      scheduledAt: { gte: now, lte: until },
    },
    orderBy: { scheduledAt: "asc" },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, email: true } },
      doctor: { select: { id: true, name: true, email: true } },
    },
  })
}

export async function markReminderSent(id: string) {
  return prisma.appointment.update({
    where: { id },
    data: { reminderSentAt: new Date() },
  })
}
