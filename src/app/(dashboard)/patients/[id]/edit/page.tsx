import { notFound } from "next/navigation"
import { Header } from "@/components/layout/header"
import { getPatientById } from "@/lib/db/patients"
import { getDoctors } from "@/lib/db/users"
import { prisma } from "@/lib/prisma"
import { EditPatientForm } from "./_components/edit-patient-form"

interface EditPatientPageProps {
  params: Promise<{ id: string }>
}

export default async function EditPatientPage({ params }: EditPatientPageProps) {
  const { id } = await params
  const [patient, rawDoctors, departments] = await Promise.all([
    getPatientById(id),
    getDoctors(),
    prisma.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, color: true } }),
  ])
  if (!patient) notFound()

  const doctors = rawDoctors.map((d) => ({
    id: d.id,
    name: d.name,
    roleLabel: d.role.label,
    patientCount: d._count.patients,
    departmentIds: d.departments.map((dep) => dep.id),
  }))

  return (
    <div>
      <Header
        title={`${patient.firstName} ${patient.lastName}`}
        subtitle="Hasta Bilgilerini Düzenle"
      />
      <div className="p-6">
        <EditPatientForm patient={patient} doctors={doctors} departments={departments} />
      </div>
    </div>
  )
}
