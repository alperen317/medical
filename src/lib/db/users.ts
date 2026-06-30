import "server-only"
import { prisma } from "@/lib/prisma"

export async function getUsers() {
  return prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      roleId: true,
      role: { select: { id: true, name: true, label: true } },
      departments: { select: { id: true, name: true, color: true } },
      setupToken: true,
      createdAt: true,
      _count: {
        select: { patients: true, timelineEvents: true },
      },
    },
  })
}

export type UserListItem = Awaited<ReturnType<typeof getUsers>>[number]

export async function getUserCount() {
  return prisma.user.count()
}

export async function getDoctors() {
  return prisma.user.findMany({
    where: {
      role: { name: { in: ["doctor", "doktor", "hekim"] } },
    },
    select: {
      id: true,
      name: true,
      role: { select: { label: true } },
      departments: { select: { id: true, name: true } },
      _count: { select: { patients: true } },
    },
    orderBy: { name: "asc" },
  })
}

export type DoctorListItem = Awaited<ReturnType<typeof getDoctors>>[number]
