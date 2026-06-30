import "server-only"
import { prisma } from "@/lib/prisma"

export async function getDepartments() {
  return prisma.department.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { users: true } },
    },
  })
}

export type DepartmentListItem = Awaited<ReturnType<typeof getDepartments>>[number]
