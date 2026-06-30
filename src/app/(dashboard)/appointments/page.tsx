import { Header } from "@/components/layout/header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CalendarDays, Clock, CheckCircle2, XCircle, CalendarX } from "lucide-react"
import Link from "next/link"
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek } from "date-fns"
import { tr } from "date-fns/locale"
import { getAppointments, getAppointmentStats } from "@/lib/db/appointments"
import { getDoctors } from "@/lib/db/users"
import { prisma } from "@/lib/prisma"
import { NewAppointmentButton } from "./_components/new-appointment-dialog"
import { AppointmentStatusButton } from "./_components/appointment-status-button"
import { cn } from "@/lib/utils"
import { getServerT } from "@/lib/i18n/server"

const TYPE_COLORS: Record<string, string> = {
  consultation: "bg-blue-100 text-blue-700 border-blue-200",
  follow_up: "bg-teal-100 text-teal-700 border-teal-200",
  procedure: "bg-amber-100 text-amber-700 border-amber-200",
  lab: "bg-purple-100 text-purple-700 border-purple-200",
  other: "bg-slate-100 text-slate-700 border-slate-200",
}

const STATUS_BADGE: Record<string, "secondary" | "success" | "destructive" | "outline"> = {
  scheduled: "secondary",
  completed: "success",
  cancelled: "destructive",
  no_show: "outline",
}

interface AppointmentsPageProps {
  searchParams: Promise<{ tab?: string }>
}

export default async function AppointmentsPage({ searchParams }: AppointmentsPageProps) {
  const t = await getServerT()
  const { tab = "today" } = await searchParams

  const now = new Date()
  let from: Date | undefined
  let to: Date | undefined

  if (tab === "today") {
    from = startOfDay(now)
    to = endOfDay(now)
  } else if (tab === "week") {
    from = startOfWeek(now, { weekStartsOn: 1 })
    to = endOfWeek(now, { weekStartsOn: 1 })
  }

  const [appointments, stats, rawDoctors, patients] = await Promise.all([
    getAppointments({ from, to }),
    getAppointmentStats(from ?? new Date(0), to ?? new Date("2100-01-01")),
    getDoctors(),
    prisma.patient.findMany({
      orderBy: { firstName: "asc" },
      select: { id: true, firstName: true, lastName: true, phone: true },
    }),
  ])

  const doctors = rawDoctors.map((d) => ({
    id: d.id,
    name: d.name,
    roleLabel: d.role.label,
  }))

  const TYPE_LABELS: Record<string, string> = {
    consultation: t("type.appointment.consultation"),
    follow_up:    t("type.appointment.follow_up"),
    procedure:    t("type.appointment.procedure"),
    lab:          t("type.appointment.lab"),
    other:        t("type.appointment.other"),
  }

  const STATUS_LABELS: Record<string, string> = {
    scheduled: t("status.appointment.scheduled"),
    completed: t("status.appointment.completed"),
    cancelled: t("status.appointment.cancelled"),
    no_show:   t("status.appointment.no_show"),
  }

  const TABS = [
    { value: "today", label: t("common.today") },
    { value: "week",  label: t("common.this_week") },
    { value: "all",   label: t("common.all") },
  ]

  const groupedByDate = appointments.reduce<Record<string, typeof appointments>>((acc, appt) => {
    const key = format(new Date(appt.scheduledAt), "yyyy-MM-dd")
    if (!acc[key]) acc[key] = []
    acc[key].push(appt)
    return acc
  }, {})

  const sortedDates = Object.keys(groupedByDate).sort()

  return (
    <div>
      <Header
        title={t("page.appointments.title")}
        subtitle={format(now, "d MMMM yyyy, EEEE", { locale: tr })}
      />

      <div className="p-6 space-y-6">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex gap-1 rounded-lg border bg-muted/50 p-1">
            {TABS.map((tab_) => (
              <Link
                key={tab_.value}
                href={`/appointments?tab=${tab_.value}`}
                className={cn(
                  "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                  tab === tab_.value
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab_.label}
              </Link>
            ))}
          </div>

          <NewAppointmentButton doctors={doctors} patients={patients} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50">
                <CalendarDays className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("common.total")}</p>
                <p className="text-xl font-bold">{stats.total}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-50">
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("appointment.stats.waiting")}</p>
                <p className="text-xl font-bold">{stats.scheduled}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/40">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("status.appointment.completed")}</p>
                <p className="text-xl font-bold">{stats.completed}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50">
                <XCircle className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("status.appointment.cancelled")}</p>
                <p className="text-xl font-bold">{stats.cancelled}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Appointment List */}
        {appointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <CalendarX className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="font-medium text-muted-foreground">
              {tab === "today"
                ? t("appointment.empty.today")
                : tab === "week"
                ? t("appointment.empty.week")
                : t("appointment.empty.all")}
            </p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              {t("appointment.empty.hint")}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {sortedDates.map((dateKey) => {
              const dayAppts = groupedByDate[dateKey]
              const dateLabel = format(
                new Date(dateKey + "T00:00:00"),
                "d MMMM yyyy, EEEE",
                { locale: tr }
              )
              const isToday = dateKey === format(now, "yyyy-MM-dd")
              return (
                <div key={dateKey}>
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-sm font-semibold text-muted-foreground">
                      {isToday ? `${t("common.today")} — ${dateLabel}` : dateLabel}
                    </h3>
                    <span className="h-px flex-1 bg-border" />
                    <span className="text-xs text-muted-foreground">{dayAppts.length} {t("nav.appointments").toLowerCase()}</span>
                  </div>
                  <div className="space-y-2">
                    {dayAppts.map((appt) => (
                      <Card
                        key={appt.id}
                        className={cn(
                          "transition-colors",
                          appt.status === "cancelled" && "opacity-60",
                          appt.status === "completed" && "bg-muted/30"
                        )}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4 flex-wrap sm:flex-nowrap">
                            <div className="flex flex-col items-center min-w-13">
                              <span className="text-base font-bold">
                                {format(new Date(appt.scheduledAt), "HH:mm")}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {appt.duration} {t("appointment.duration_unit")}
                              </span>
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Link
                                  href={`/patients/${appt.patient.id}`}
                                  className="font-semibold hover:underline"
                                >
                                  {appt.patient.firstName} {appt.patient.lastName}
                                </Link>
                                <span
                                  className={cn(
                                    "rounded-full border px-2 py-0.5 text-xs font-medium",
                                    TYPE_COLORS[appt.type] ?? "bg-slate-100 text-slate-700"
                                  )}
                                >
                                  {TYPE_LABELS[appt.type] ?? appt.type}
                                </span>
                                <Badge variant={STATUS_BADGE[appt.status] ?? "secondary"}>
                                  {STATUS_LABELS[appt.status] ?? appt.status}
                                </Badge>
                              </div>
                              <p className="mt-0.5 text-sm text-muted-foreground">
                                {appt.doctor.name} · {appt.doctor.role.label}
                              </p>
                              {appt.notes && (
                                <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                                  {appt.notes}
                                </p>
                              )}
                            </div>

                            <div className="shrink-0">
                              <AppointmentStatusButton id={appt.id} status={appt.status} />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
