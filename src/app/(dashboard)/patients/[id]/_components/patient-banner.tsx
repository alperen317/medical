import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Droplets, User, Hash } from "lucide-react"
import type { PatientStatus } from "@/generated/prisma/enums"
import { cn } from "@/lib/utils"

// Hasta durumuna göre banner'ın sol renk şeridi (tek, sakin bir aksan).
const STATUS_STRIPE: Record<PatientStatus, string> = {
  active:     "bg-emerald-500",
  critical:   "bg-red-500",
  inactive:   "bg-slate-400",
  discharged: "bg-blue-500",
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
      <Icon className={cn("h-4 w-4 shrink-0", accent ? "text-red-500" : "text-muted-foreground")} />
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
  patientNo,
  age,
  genderLabel,
  bloodLabel,
  labels,
}: {
  firstName: string
  lastName: string
  doctorName?: string | null
  status: PatientStatus
  patientNo: string
  age: number
  genderLabel: string
  bloodLabel: string | null
  labels: { patientNo: string; ageGender: string; bloodType: string; ageUnit: string }
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border bg-card">
      {/* Durum renk şeridi */}
      <div className={cn("absolute inset-y-0 left-0 w-1", STATUS_STRIPE[status])} />

      <div className="flex flex-col gap-4 pl-6 pr-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Kimlik */}
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="h-12 w-12 shrink-0">
            <AvatarFallback className="text-base font-bold bg-primary/10 text-primary">
              {firstName[0]}{lastName[0]}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1 className="text-lg font-bold leading-tight truncate">{firstName} {lastName}</h1>
            {doctorName && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{doctorName}</p>
            )}
          </div>
        </div>

        {/* Stat kümesi */}
        <div className="flex flex-wrap items-center gap-y-3 divide-x divide-border sm:justify-end">
          <Stat icon={Hash} label={labels.patientNo} value={<span className="font-mono">{patientNo}</span>} />
          <Stat icon={User} label={labels.ageGender} value={`${age} ${labels.ageUnit} · ${genderLabel}`} />
          {bloodLabel && <Stat icon={Droplets} label={labels.bloodType} value={bloodLabel} accent />}
        </div>
      </div>
    </div>
  )
}
