import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getActivityLogs } from "@/lib/db/activity"
import { verifySession } from "@/lib/dal"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import {
  LogIn, LogOut, UserPlus, UserCog, UserMinus, ShieldCheck, Building2,
  Users, Stethoscope, ArrowRight, ChevronLeft, ChevronRight, Brain, Microscope,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { getServerT } from "@/lib/i18n/server"

const ACTION_STYLE: Record<string, {
  Icon: React.ElementType
  iconBg: string
  iconColor: string
  badgeVariant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info"
}> = {
  "auth.login":               { Icon: LogIn,       iconBg: "bg-green-50 dark:bg-green-950/40",     iconColor: "text-green-600 dark:text-green-400",     badgeVariant: "success" },
  "auth.logout":              { Icon: LogOut,      iconBg: "bg-slate-100 dark:bg-slate-800",       iconColor: "text-slate-500 dark:text-slate-400",     badgeVariant: "secondary" },
  "patient.create":           { Icon: UserPlus,    iconBg: "bg-blue-50 dark:bg-blue-950/40",       iconColor: "text-blue-600 dark:text-blue-400",       badgeVariant: "info" },
  "patient.update":           { Icon: UserCog,     iconBg: "bg-amber-50 dark:bg-amber-950/40",     iconColor: "text-amber-600 dark:text-amber-400",     badgeVariant: "warning" },
  "patient.status_change":    { Icon: UserCog,     iconBg: "bg-orange-50 dark:bg-orange-950/40",   iconColor: "text-orange-600 dark:text-orange-400",   badgeVariant: "warning" },
  "patient.delete":           { Icon: UserMinus,   iconBg: "bg-red-50 dark:bg-red-950/40",         iconColor: "text-red-600 dark:text-red-400",         badgeVariant: "destructive" },
  "user.create":              { Icon: UserPlus,    iconBg: "bg-purple-50 dark:bg-purple-950/40",   iconColor: "text-purple-600 dark:text-purple-400",   badgeVariant: "info" },
  "user.update":              { Icon: UserCog,     iconBg: "bg-violet-50 dark:bg-violet-950/40",   iconColor: "text-violet-600 dark:text-violet-400",   badgeVariant: "secondary" },
  "user.role_change":         { Icon: ShieldCheck, iconBg: "bg-indigo-50 dark:bg-indigo-950/40",   iconColor: "text-indigo-600 dark:text-indigo-400",   badgeVariant: "info" },
  "user.delete":              { Icon: UserMinus,   iconBg: "bg-red-50 dark:bg-red-950/40",         iconColor: "text-red-600 dark:text-red-400",         badgeVariant: "destructive" },
  "role.create":              { Icon: ShieldCheck, iconBg: "bg-teal-50 dark:bg-teal-950/40",       iconColor: "text-teal-600 dark:text-teal-400",       badgeVariant: "info" },
  "role.update_permissions":  { Icon: ShieldCheck, iconBg: "bg-cyan-50 dark:bg-cyan-950/40",       iconColor: "text-cyan-600 dark:text-cyan-400",       badgeVariant: "warning" },
  "role.update_label":        { Icon: ShieldCheck, iconBg: "bg-cyan-50 dark:bg-cyan-950/40",       iconColor: "text-cyan-600 dark:text-cyan-400",       badgeVariant: "secondary" },
  "role.delete":              { Icon: ShieldCheck, iconBg: "bg-red-50 dark:bg-red-950/40",         iconColor: "text-red-600 dark:text-red-400",         badgeVariant: "destructive" },
  "department.create":        { Icon: Building2,   iconBg: "bg-emerald-50 dark:bg-emerald-950/40", iconColor: "text-emerald-600 dark:text-emerald-400", badgeVariant: "info" },
  "department.update":        { Icon: Building2,   iconBg: "bg-green-50 dark:bg-green-950/40",     iconColor: "text-green-600 dark:text-green-400",     badgeVariant: "secondary" },
  "department.delete":        { Icon: Building2,   iconBg: "bg-red-50 dark:bg-red-950/40",         iconColor: "text-red-600 dark:text-red-400",         badgeVariant: "destructive" },
  "timeline.create":          { Icon: Stethoscope, iconBg: "bg-blue-50 dark:bg-blue-950/40",       iconColor: "text-blue-600 dark:text-blue-400",       badgeVariant: "info" },
  "timeline.delete":          { Icon: Stethoscope, iconBg: "bg-red-50 dark:bg-red-950/40",         iconColor: "text-red-600 dark:text-red-400",         badgeVariant: "destructive" },
  "ai.brain_segmentation":    { Icon: Brain,       iconBg: "bg-sky-50 dark:bg-sky-950/40",         iconColor: "text-sky-600 dark:text-sky-400",         badgeVariant: "info" },
  "ai.pathology_detection":   { Icon: Microscope,  iconBg: "bg-violet-50 dark:bg-violet-950/40",   iconColor: "text-violet-600 dark:text-violet-400",   badgeVariant: "info" },
}

const ENTITY_FILTER_ICONS: Record<string, React.ElementType> = {
  all: Users, auth: LogIn, patient: UserPlus, user: UserCog,
  role: ShieldCheck, department: Building2, timeline: Stethoscope,
}

interface ActivityPageProps {
  searchParams: Promise<{ entityType?: string; page?: string }>
}

export default async function ActivityPage({ searchParams }: ActivityPageProps) {
  await verifySession()
  const t = await getServerT()
  const { entityType = "all", page: pageParam = "1" } = await searchParams
  const page = Math.max(1, parseInt(pageParam, 10) || 1)

  const { logs, total, totalPages } = await getActivityLogs({
    page,
    limit: 50,
    entityType: entityType === "all" ? undefined : entityType,
  })

  const ACTION_LABELS: Record<string, string> = {
    "auth.login":                        t("activity.action.auth.login"),
    "auth.logout":                       t("activity.action.auth.logout"),
    "patient.create":                    t("activity.action.patient.create"),
    "patient.update":                    t("activity.action.patient.update"),
    "patient.status_change":             t("activity.action.patient.status_change"),
    "patient.delete":                    t("activity.action.patient.delete"),
    "user.create":                       t("activity.action.user.create"),
    "user.update":                       t("activity.action.user.update"),
    "user.role_change":                  t("activity.action.user.role_change"),
    "user.delete":                       t("activity.action.user.delete"),
    "user.invite_resent":                t("activity.action.user.invite_resent"),
    "role.create":                       t("activity.action.role.create"),
    "role.update_permissions":           t("activity.action.role.update_permissions"),
    "role.update_label":                 t("activity.action.role.update_label"),
    "role.delete":                       t("activity.action.role.delete"),
    "department.create":                 t("activity.action.department.create"),
    "department.update":                 t("activity.action.department.update"),
    "department.delete":                 t("activity.action.department.delete"),
    "timeline.create":                   t("activity.action.timeline.create"),
    "timeline.delete":                   t("activity.action.timeline.delete"),
    "appointment.create":                t("activity.action.appointment.create"),
    "appointment.status_change":         t("activity.action.appointment.status_change"),
    "prescription.create":               t("activity.action.prescription.create"),
    "settings.update":                   t("activity.action.settings.update"),
    "settings.translation.update":       t("activity.action.settings.translation.update"),
    "settings.translation.reset":        t("activity.action.settings.translation.reset"),
    "ai.brain_segmentation":             t("activity.action.ai.brain_segmentation"),
    "ai.pathology_detection":            t("activity.action.ai.pathology_detection"),
  }

  const ENTITY_FILTERS = [
    { value: "all",        label: t("common.all"),               Icon: ENTITY_FILTER_ICONS.all },
    { value: "auth",       label: t("activity.filter.auth"),     Icon: ENTITY_FILTER_ICONS.auth },
    { value: "patient",    label: t("nav.patients"),             Icon: ENTITY_FILTER_ICONS.patient },
    { value: "user",       label: t("nav.users"),                Icon: ENTITY_FILTER_ICONS.user },
    { value: "role",       label: t("nav.roles"),                Icon: ENTITY_FILTER_ICONS.role },
    { value: "department", label: t("nav.departments"),          Icon: ENTITY_FILTER_ICONS.department },
    { value: "timeline",   label: t("activity.filter.timeline"), Icon: ENTITY_FILTER_ICONS.timeline },
  ]

  return (
    <div>
      <Header title={t("page.activity.title")} subtitle={t("page.activity.subtitle")} />
      <div className="p-6 space-y-4">

        {/* Filter bar */}
        <div className="flex flex-wrap gap-1.5">
          {ENTITY_FILTERS.map((f) => {
            const Icon = f.Icon
            const isActive = entityType === f.value || (f.value === "all" && !entityType)
            return (
              <Link
                key={f.value}
                href={`/activity?entityType=${f.value}&page=1`}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors
                  ${isActive
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                  }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {f.label}
              </Link>
            )
          })}
        </div>

        {/* Log list */}
        <Card>
          <CardContent className="p-0">
            {logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
                <p className="font-medium text-muted-foreground">{t("activity.empty")}</p>
                <p className="text-sm text-muted-foreground/60">{t("activity.empty.description")}</p>
              </div>
            ) : (
              <div className="divide-y">
                {logs.map((log) => {
                  const style = ACTION_STYLE[log.action]
                  const Icon = style?.Icon ?? Users
                  const label = ACTION_LABELS[log.action] ?? log.action

                  return (
                    <div key={log.id} className="flex items-start gap-3 px-5 py-3.5">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full mt-0.5 ${style?.iconBg ?? "bg-muted"}`}>
                        <Icon className={`h-3.5 w-3.5 ${style?.iconColor ?? "text-muted-foreground"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">
                            {log.actor?.name ?? t("activity.system_actor")}
                          </span>
                          {log.actor?.role?.label && (
                            <span className="text-xs text-muted-foreground">· {log.actor.role.label}</span>
                          )}
                          <Badge variant={style?.badgeVariant ?? "secondary"} className="text-[10px] h-4 px-1.5">
                            {label}
                          </Badge>
                          {log.entityLabel && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <ArrowRight className="h-3 w-3 shrink-0" />
                              {log.entityLabel}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(log.createdAt, "d MMMM yyyy, HH:mm", { locale: tr })}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{total} {t("common.total")} · {t("common.previous")} {page}/{totalPages}</span>
            <div className="flex gap-1">
              {page > 1 && (
                <Link href={`/activity?entityType=${entityType}&page=${page - 1}`}>
                  <Button variant="outline" size="sm" className="gap-1">
                    <ChevronLeft className="h-4 w-4" />
                    {t("common.previous")}
                  </Button>
                </Link>
              )}
              {page < totalPages && (
                <Link href={`/activity?entityType=${entityType}&page=${page + 1}`}>
                  <Button variant="outline" size="sm" className="gap-1">
                    {t("common.next")}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
