import { redirect } from "next/navigation"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  User, Phone, Calendar, ChevronRight, AlertTriangle, UserCheck,
} from "lucide-react"
import { format, differenceInYears } from "date-fns"
import { tr } from "date-fns/locale"
import { verifySession } from "@/lib/dal"
import { getPatients } from "@/lib/db/patients"
import { MyPatientsFilters } from "./_components/my-patients-filters"
import type { PatientStatus } from "@/generated/prisma/enums"
import { Suspense } from "react"
import { getServerT } from "@/lib/i18n/server"

const DOCTOR_ROLES = ["doctor", "doktor", "hekim"]

const bloodTypeLabels: Record<string, string> = {
  A_pos: "A+", A_neg: "A-", B_pos: "B+", B_neg: "B-",
  AB_pos: "AB+", AB_neg: "AB-", O_pos: "O+", O_neg: "O-",
}

interface MyPatientsPageProps {
  searchParams: Promise<{ search?: string; status?: string }>
}

export default async function MyPatientsPage({ searchParams }: MyPatientsPageProps) {
  const t = await getServerT()
  const session = await verifySession()

  if (!DOCTOR_ROLES.includes(session.roleName)) {
    redirect("/patients")
  }

  const { search, status } = await searchParams

  const { patients, total } = await getPatients({
    assignedDoctorId: session.userId,
    search: search || undefined,
    status: status as PatientStatus | undefined,
  })

  const statusConfig: Record<PatientStatus, { label: string; variant: "success" | "secondary" | "destructive" | "outline" }> = {
    active:     { label: t("status.patient.active"),     variant: "success" },
    inactive:   { label: t("status.patient.inactive"),   variant: "secondary" },
    critical:   { label: t("status.patient.critical"),   variant: "destructive" },
    discharged: { label: t("status.patient.discharged"), variant: "outline" },
  }

  const critical = patients.filter((p) => p.status === "critical").length
  const active = patients.filter((p) => p.status === "active").length

  const genderLabel = (g: string) =>
    g === "male" ? t("gender.male") : g === "female" ? t("gender.female") : t("gender.other")

  return (
    <div>
      <Header
        title={t("page.my_patients.title")}
        subtitle={`${session.name} — ${total} ${t("patient.registered_count_suffix")}`}
      />

      <div className="p-6 space-y-5">
        {/* Stats */}
        <div className="flex gap-4 flex-wrap">
          <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2 text-sm">
            <UserCheck className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{total}</span>
            <span className="text-muted-foreground">{t("common.total")}</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2 text-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="font-medium">{active}</span>
            <span className="text-muted-foreground">{t("status.patient.active")}</span>
          </div>
          {critical > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="font-medium text-destructive">{critical}</span>
              <span className="text-muted-foreground">{t("status.patient.critical")}</span>
            </div>
          )}
        </div>

        {/* Filters */}
        <Suspense>
          <MyPatientsFilters />
        </Suspense>

        {/* Patient List */}
        {patients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <User className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">
              {search || status
                ? t("my_patients.empty.no_match")
                : t("my_patients.empty.none")}
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {patients.map((patient) => {
              const st = statusConfig[patient.status]
              const age = differenceInYears(new Date(), new Date(patient.dateOfBirth))
              const bloodLabel = patient.bloodType ? bloodTypeLabels[patient.bloodType] : null
              return (
                <Link key={patient.id} href={`/patients/${patient.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer group">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12 shrink-0">
                          <AvatarFallback className="text-sm font-semibold bg-primary/10 text-primary">
                            {patient.firstName[0]}{patient.lastName[0]}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold">
                              {patient.firstName} {patient.lastName}
                            </h3>
                            <Badge variant={st.variant}>{st.label}</Badge>
                            {patient.status === "critical" && (
                              <AlertTriangle className="h-4 w-4 text-destructive" />
                            )}
                          </div>

                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {age} {t("patient.age_suffix")} · {genderLabel(patient.gender)}
                              {bloodLabel && ` · ${bloodLabel}`}
                            </span>
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {patient.phone}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(patient.createdAt), "d MMM yyyy", { locale: tr })}
                            </span>
                          </div>

                          {patient.chronicConditions.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {patient.chronicConditions.map((c) => (
                                <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="hidden sm:flex flex-col items-end gap-1 shrink-0 text-xs text-muted-foreground">
                          {patient.allergies.length > 0 && (
                            <Badge variant="warning" className="text-xs">
                              {t("patient.allergy_prefix")} {patient.allergies.length}
                            </Badge>
                          )}
                        </div>

                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
