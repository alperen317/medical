import { getDoctors } from "@/lib/db/users"
import { Header } from "@/components/layout/header"
import { NewPatientForm } from "./_components/new-patient-form"
import { prisma } from "@/lib/prisma"

export default async function NewPatientPage() {
  const [doctors, departments] = await Promise.all([
    getDoctors(),
    prisma.department.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    }),
  ])

  const doctorList = doctors.map((d) => ({
    id: d.id,
    name: d.name,
    roleLabel: d.role.label,
    patientCount: d._count.patients,
    departmentIds: d.departments.map((dep) => dep.id),
  }))

  return (
    <div>
      <Header title="Yeni Hasta Kaydı" subtitle="Hasta bilgilerini eksiksiz doldurun" />
      <div className="p-6">
        <NewPatientForm doctors={doctorList} departments={departments} />
      </div>
    </div>
  )
}
