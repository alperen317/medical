import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Droplets, User, IdCard, Stethoscope } from "lucide-react"
import type { PatientStatus } from "@/generated/prisma/enums"
import { cn } from "@/lib/utils"

// Hasta durumuna göre banner'ın sol renk şeridi (tek, sakin bir aksan).
const STATUS_STRIPE: Record<PatientStatus, string> = {
  active:     "bg-emerald-500",
  critical:   "bg-red-500",
  inactive:   "bg-slate-400",
  discharged: "bg-blue-500",
}

const STATUS_BADGE: Record<PatientStatus, "success" | "destructive" | "secondary" | "outline"> = {
  active:     "success",
  critical:   "destructive",
  inactive:   "secondary",
  discharged: "outline",
}

function Stat({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType
  label: string
  value: React.ReactNode
  accent?: boolean
}) {
  return (
    <div className="flex items-center gap-2.5 px-4">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/60">
        <Icon className={cn("h-4 w-4", accent ? "text-red-500" : "text-muted-foreground")} />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground leading-none">
          {label}
        </p>
        <p className={cn("text-sm font-semibold mt-1 leading-none truncate", accent && "text-red-600 dark:text-red-400")}>
          {value}
        </p>
      </div>
    </div>
  )
}

export function PatientBanner({
  firstName,
  lastName,
  doctorName,
  status,
  statusLabel,
  tcNo,
  age,
  genderLabel,
  bloodLabel,
  labels,
}: {
  firstName: string
  lastName: string
  doctorName?: string | null
  status: PatientStatus
  statusLabel: string
  tcNo: string
  age: number
  genderLabel: string
  bloodLabel: string | null
  labels: { tcNo: string; ageGender: string; bloodType: string; ageUnit: string }
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-card shadow-sm animate-in-up">
      {/* Durum renk şeridi */}
      <div className={cn("absolute inset-y-0 left-0 w-1.5", STATUS_STRIPE[status])} />

      {/* Hafif degrade arka plan aksanı */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-primary/5 blur-2xl"
      />

      <div className="relative flex flex-col gap-4 pl-6 pr-5 py-5 sm:flex-row sm:items-center sm:justify-between">
        {/* Kimlik */}
        <div className="flex items-center gap-4 min-w-0">
          <Avatar className="h-14 w-14 shrink-0 ring-2 ring-primary/15 ring-offset-2 ring-offset-card">
            <AvatarFallback className="text-lg font-bold bg-primary/10 text-primary">
              {firstName[0]}{lastName[0]}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold leading-tight truncate">{firstName} {lastName}</h1>
              <Badge variant={STATUS_BADGE[status]} className="shrink-0">
                {statusLabel}
              </Badge>
            </div>
            {doctorName && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1 truncate">
                <Stethoscope className="h-3 w-3 shrink-0" />
                {doctorName}
              </p>
            )}
          </div>
        </div>

        {/* Stat kümesi */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:divide-x sm:divide-border sm:justify-end">
          <Stat icon={IdCard} label={labels.tcNo} value={<span className="font-mono">{tcNo}</span>} />
          <Stat icon={User} label={labels.ageGender} value={`${age} ${labels.ageUnit} · ${genderLabel}`} />
          {bloodLabel && <Stat icon={Droplets} label={labels.bloodType} value={bloodLabel} accent />}
        </div>
      </div>
    </div>
  )
}
