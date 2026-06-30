import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client"
import type { PatientStatus } from "@/generated/prisma/enums"
import type { PatientGetPayload } from "@/generated/prisma/models/Patient"

export type PatientWithRelations = PatientGetPayload<{
  include: {
    assignedDoctor: { select: { id: true; name: true } }
    _count: { select: { timelineEvents: true; diagnoses: true } }
  }
}>

export type PatientSort = "date_desc" | "date_asc" | "name_asc" | "name_desc" | "status" | "updated_desc"

const SORT_MAP: Record<PatientSort, Prisma.PatientOrderByWithRelationInput | Prisma.PatientOrderByWithRelationInput[]> = {
  updated_desc: { updatedAt: "desc" },
  date_desc:    { createdAt: "desc" },
  date_asc:     { createdAt: "asc" },
  name_asc:     [{ firstName: "asc" }, { lastName: "asc" }],
  name_desc:    [{ firstName: "desc" }, { lastName: "desc" }],
  status:       [{ status: "asc" }, { createdAt: "desc" }],
}

export async function getPatients(opts?: {
  search?: string
  status?: PatientStatus
  assignedDoctorId?: string
  sort?: PatientSort
  page?: number
  limit?: number
}) {
  const { search, status, assignedDoctorId, sort = "updated_desc", page = 1, limit = 50 } = opts ?? {}

  const where: Prisma.PatientWhereInput = {}

  if (status) where.status = status
  if (assignedDoctorId) where.assignedDoctorId = assignedDoctorId

  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { tcNo: { contains: search } },
      { phone: { contains: search } },
      { email: { contains: search, mode: "insensitive" } },
    ]
  }

  const orderBy = SORT_MAP[sort] ?? SORT_MAP.updated_desc

  const [patients, total] = await Promise.all([
    prisma.patient.findMany({
      where,
      include: {
        assignedDoctor: { select: { id: true, name: true } },
        _count: { select: { timelineEvents: true, diagnoses: true } },
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.patient.count({ where }),
  ])

  return { patients, total, page, limit }
}

export async function getPatientById(id: string) {
  return prisma.patient.findUnique({
    where: { id },
    include: {
      assignedDoctor: { select: { id: true, name: true } },
      diagnoses: {
        orderBy: { diagnosedAt: "desc" },
        include: { diagnosedBy: { select: { id: true, name: true } } },
      },
      prescriptions: {
        orderBy: { prescribedAt: "desc" },
        include: { prescribedBy: { select: { id: true, name: true } } },
      },
      timelineEvents: {
        orderBy: { date: "desc" },
        include: {
          createdBy: { select: { id: true, name: true } },
          attachments: true,
        },
      },
    },
  })
}

export async function createPatient(data: Prisma.PatientCreateInput) {
  return prisma.patient.create({ data })
}

export async function updatePatient(id: string, data: Prisma.PatientUpdateInput) {
  return prisma.patient.update({ where: { id }, data })
}

export async function getDashboardStats() {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const dayStart = new Date(now.setHours(0, 0, 0, 0))
  const dayEnd = new Date(new Date().setHours(23, 59, 59, 999))

  const [total, active, critical, todayEvents, newThisMonth] = await Promise.all([
    prisma.patient.count(),
    prisma.patient.count({ where: { status: "active" } }),
    prisma.patient.count({ where: { status: "critical" } }),
    prisma.timelineEvent.count({
      where: { date: { gte: dayStart, lt: dayEnd } },
    }),
    prisma.patient.count({ where: { createdAt: { gte: monthStart } } }),
  ])

  return { total, active, critical, todayEvents, newThisMonth }
}
