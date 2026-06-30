import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Users, AlertTriangle, TrendingUp, Clock,
  Activity, ChevronRight, UserCheck, CalendarDays,
} from "lucide-react"
import Link from "next/link"
import { getDashboardStats } from "@/lib/db/patients"
import { prisma } from "@/lib/prisma"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { getServerT } from "@/lib/i18n/server"

const ACTION_COLORS: Record<string, string> = {
  "patient.create": "bg-blue-500",
  "patient.update": "bg-blue-400",
  "patient.status_change": "bg-amber-500",
  "patient.delete": "bg-red-500",
  "timeline.create": "bg-green-500",
  "timeline.delete": "bg-red-400",
  "auth.login": "bg-emerald-500",
  "auth.logout": "bg-slate-400",
  "user.create": "bg-purple-500",
  "user.update": "bg-purple-400",
  "user.role_change": "bg-violet-500",
  "user.delete": "bg-red-500",
  "role.create": "bg-indigo-500",
  "role.update_permissions": "bg-indigo-400",
  "role.update_label": "bg-indigo-300",
  "role.delete": "bg-red-400",
  "department.create": "bg-teal-500",
  "department.update": "bg-teal-400",
  "department.delete": "bg-red-400",
  "appointment.create": "bg-cyan-500",
  "appointment.status_change": "bg-cyan-400",
  "prescription.create": "bg-teal-500",
}

export default async function DashboardPage() {
  const t = await getServerT()

  const statusConfig = {
    active:     { label: t("status.patient.active"),     variant: "success" as const },
    inactive:   { label: t("status.patient.inactive"),   variant: "secondary" as const },
    critical:   { label: t("status.patient.critical"),   variant: "destructive" as const },
    discharged: { label: t("status.patient.discharged"), variant: "outline" as const },
  }

  const ACTION_LABELS: Record<string, string> = {
    "auth.login":               t("activity.action.auth.login"),
    "auth.logout":              t("activity.action.auth.logout"),
    "patient.create":           t("activity.action.patient.create"),
    "patient.update":           t("activity.action.patient.update"),
    "patient.status_change":    t("activity.action.patient.status_change"),
    "patient.delete":           t("activity.action.patient.delete"),
    "timeline.create":          t("activity.action.timeline.create"),
    "timeline.delete":          t("activity.action.timeline.delete"),
    "user.create":              t("activity.action.user.create"),
    "user.update":              t("activity.action.user.update"),
    "user.role_change":         t("activity.action.user.role_change"),
    "user.delete":              t("activity.action.user.delete"),
    "role.create":              t("activity.action.role.create"),
    "role.update_permissions":  t("activity.action.role.update_permissions"),
    "role.update_label":        t("activity.action.role.update_label"),
    "role.delete":              t("activity.action.role.delete"),
    "department.create":        t("activity.action.department.create"),
    "department.update":        t("activity.action.department.update"),
    "department.delete":        t("activity.action.department.delete"),
    "appointment.create":       t("activity.action.appointment.create"),
    "appointment.status_change":t("activity.action.appointment.status_change"),
    "prescription.create":      t("activity.action.prescription.create"),
  }

  const [stats, recentPatients, recentActivity] = await Promise.all([
    getDashboardStats(),
    prisma.patient.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        status: true,
        phone: true,
        assignedDoctor: { select: { name: true } },
      },
    }),
    prisma.activityLog.findMany({
      take: 6,
      orderBy: { createdAt: "desc" },
      include: {
        actor: { select: { name: true, role: { select: { label: true } } } },
      },
    }),
  ])

  return (
    <div>
      <Header title={t("page.dashboard.title")} subtitle={format(new Date(), "d MMMM yyyy, EEEE", { locale: tr })} />

      <div className="p-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-5">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("dashboard.stats.total_patients")}</p>
                  <p className="mt-1.5 text-2xl font-bold nums">{stats.total}</p>
                </div>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Users className="h-4 w-4 text-primary" />
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                <span className="text-(--status-success-fg) font-medium">+{stats.newThisMonth}</span> {t("dashboard.stats.this_month_suffix")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("dashboard.stats.new_this_month")}</p>
                  <p className="mt-1.5 text-2xl font-bold nums">{stats.newThisMonth}</p>
                </div>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <CalendarDays className="h-4 w-4 text-primary" />
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{t("dashboard.stats.new_patient_label")}</p>
            </CardContent>
          </Card>

          <Card className={stats.critical > 0 ? "border-destructive/40 bg-destructive/[0.03]" : ""}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("dashboard.stats.critical_patients")}</p>
                  <p className={`mt-1.5 text-2xl font-bold nums ${stats.critical > 0 ? "text-destructive" : ""}`}>
                    {stats.critical}
                  </p>
                </div>
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${stats.critical > 0 ? "bg-destructive/10" : "bg-muted"}`}>
                  <AlertTriangle className={`h-4 w-4 ${stats.critical > 0 ? "text-destructive" : "text-muted-foreground"}`} />
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{t("dashboard.stats.urgent_followup")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("dashboard.stats.active_patients")}</p>
                  <p className="mt-1.5 text-2xl font-bold nums">{stats.active}</p>
                </div>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <UserCheck className="h-4 w-4 text-primary" />
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{t("dashboard.stats.under_monitoring")}</p>
            </CardContent>
          </Card>

          <Card className="hidden xl:block">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("dashboard.stats.today_activity")}</p>
                  <p className="mt-1.5 text-2xl font-bold nums">{stats.todayEvents}</p>
                </div>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{t("dashboard.stats.timeline_records")}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Recent Patients */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">{t("dashboard.recent_patients.title")}</CardTitle>
                  <CardDescription>{t("dashboard.recent_patients.desc")}</CardDescription>
                </div>
                <Link
                  href="/patients"
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  {t("common.all")} <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentPatients.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">{t("patient.empty.none")}</p>
              )}
              {recentPatients.map((patient) => {
                const status = statusConfig[patient.status]
                return (
                  <Link
                    key={patient.id}
                    href={`/patients/${patient.id}`}
                    className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50 transition-colors"
                  >
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {patient.firstName[0]}{patient.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {patient.firstName} {patient.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {patient.assignedDoctor?.name ?? t("dashboard.no_doctor")} · {patient.phone}
                      </p>
                    </div>
                    <Badge variant={status.variant} className="shrink-0">
                      {status.label}
                    </Badge>
                  </Link>
                )
              })}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">{t("dashboard.recent_activity.title")}</CardTitle>
                  <CardDescription>{t("dashboard.recent_activity.desc")}</CardDescription>
                </div>
                <Link
                  href="/activity"
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  {t("common.all")} <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentActivity.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">{t("activity.empty")}</p>
              )}
              {recentActivity.map((log) => {
                const dotColor = ACTION_COLORS[log.action] ?? "bg-slate-400"
                const label = ACTION_LABELS[log.action] ?? log.action
                return (
                  <div key={log.id} className="flex items-start gap-3">
                    <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotColor}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-1">
                        {label}
                        {log.entityLabel && (
                          <span className="text-muted-foreground font-normal"> — {log.entityLabel}</span>
                        )}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">
                          {log.actor?.name ?? t("activity.system_actor")}
                        </span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {format(log.createdAt, "d MMM HH:mm", { locale: tr })}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
