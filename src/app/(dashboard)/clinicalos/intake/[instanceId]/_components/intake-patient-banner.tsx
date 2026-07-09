import { CalendarDays, IdCard, Phone } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import type { getWorkflowInstanceById } from "@/lib/db/clinicalos-intake"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { tr } from "date-fns/locale"

type Instance = NonNullable<Awaited<ReturnType<typeof getWorkflowInstanceById>>>

const GENDER_LABELS: Record<string, string> = { male: "Erkek", female: "Kadın", other: "Diğer" }

function Stat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-1 sm:py-0">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground leading-none">
          {label}
        </p>
        <p className="text-sm font-semibold mt-1 leading-none truncate">{value}</p>
      </div>
    </div>
  )
}

// Hasta detay sayfasındaki PatientBanner ile aynı görsel dil (avatar + durum
// şeridi + stat satırı) — kabul akışında da hasta kimliği aynı şekilde,
// yatay ve tam genişlikte üstte sabit kalsın diye.
export function IntakePatientBanner({ instance }: { instance: Instance }) {
  const completed = instance.status === "completed"

  return (
    <div className="relative overflow-hidden rounded-xl border bg-card">
      <div className={cn("absolute inset-y-0 left-0 w-1", completed ? "bg-emerald-500" : "bg-violet-500")} />

      <div className="flex flex-col gap-4 pl-6 pr-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="h-12 w-12 shrink-0">
            <AvatarFallback className="text-base font-bold bg-primary/10 text-primary">
              {instance.patient.firstName[0]}
              {instance.patient.lastName[0]}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold leading-tight truncate">
                {instance.patient.firstName} {instance.patient.lastName}
              </h1>
              <Badge variant={completed ? "success" : "info"} className="text-xs shrink-0">
                {completed ? "Tamamlandı" : "Devam Ediyor"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {instance.workflowDef.name} · {instance.workflowDef.branch}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-y-2 divide-x divide-border">
          {instance.patient.tcNo && (
            <Stat icon={IdCard} label="TC No" value={<span className="font-mono">{instance.patient.tcNo}</span>} />
          )}
          <Stat
            icon={CalendarDays}
            label="Doğum / Cinsiyet"
            value={`${format(instance.patient.dateOfBirth, "d MMM yyyy", { locale: tr })} · ${GENDER_LABELS[instance.patient.gender] ?? instance.patient.gender}`}
          />
          <Stat icon={Phone} label="Telefon" value={<span className="nums">{instance.patient.phone}</span>} />
        </div>
      </div>
    </div>
  )
}
