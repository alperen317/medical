import Link from "next/link"
import { addDays, format, isSameDay, differenceInMinutes, startOfDay } from "date-fns"
import { tr } from "date-fns/locale"
import { cn } from "@/lib/utils"

const DAY_START_HOUR = 8
const DAY_END_HOUR = 20
const HOUR_HEIGHT = 56 // px
const TOTAL_HOURS = DAY_END_HOUR - DAY_START_HOUR

const TYPE_COLORS: Record<string, string> = {
  consultation: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/50 dark:text-blue-200 dark:border-blue-800",
  follow_up: "bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950/50 dark:text-teal-200 dark:border-teal-800",
  procedure: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-800",
  lab: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/50 dark:text-purple-200 dark:border-purple-800",
  other: "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800/60 dark:text-slate-200 dark:border-slate-700",
}

type CalendarAppointment = {
  id: string
  scheduledAt: Date | string
  duration: number
  type: string
  status: string
  patient: { id: string; firstName: string; lastName: string }
  doctor: { name: string }
}

// Bir gün içindeki çakışan randevuları yan yana yerleştirmek için basit şerit (lane) ataması.
function assignLanes(appts: CalendarAppointment[]) {
  const sorted = [...appts].sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
  )
  const laneEnds: number[] = []
  const result = sorted.map((appt) => {
    const start = new Date(appt.scheduledAt).getTime()
    const end = start + appt.duration * 60_000
    let lane = laneEnds.findIndex((e) => e <= start)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(end)
    } else {
      laneEnds[lane] = end
    }
    return { appt, lane, end }
  })
  const laneCount = Math.max(laneEnds.length, 1)
  return { placed: result, laneCount }
}

export function AppointmentCalendar({
  appointments,
  weekStart,
  labels,
}: {
  appointments: CalendarAppointment[]
  weekStart: Date
  labels: { typeLabels: Record<string, string>; noAppts: string }
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => DAY_START_HOUR + i)
  const today = new Date()

  return (
    <div className="rounded-lg border bg-background overflow-x-auto">
      <div className="min-w-[860px]">
        {/* Gün başlıkları */}
        <div className="grid border-b" style={{ gridTemplateColumns: `56px repeat(7, 1fr)` }}>
          <div className="border-r" />
          {days.map((day) => {
            const isToday = isSameDay(day, today)
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "border-r px-2 py-2 text-center last:border-r-0",
                  isToday && "bg-primary/5"
                )}
              >
                <div className="text-xs font-medium text-muted-foreground uppercase">
                  {format(day, "EEE", { locale: tr })}
                </div>
                <div
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    isToday && "text-primary"
                  )}
                >
                  {format(day, "d MMM", { locale: tr })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Izgara gövdesi */}
        <div className="grid" style={{ gridTemplateColumns: `56px repeat(7, 1fr)` }}>
          {/* Saat gutter'ı */}
          <div className="border-r">
            {hours.map((h) => (
              <div
                key={h}
                className="relative border-b text-[10px] text-muted-foreground"
                style={{ height: HOUR_HEIGHT }}
              >
                <span className="absolute -top-1.5 right-1.5 tabular-nums">
                  {String(h).padStart(2, "0")}:00
                </span>
              </div>
            ))}
          </div>

          {/* Gün kolonları */}
          {days.map((day) => {
            const dayStart = startOfDay(day)
            const dayAppts = appointments.filter((a) => isSameDay(new Date(a.scheduledAt), day))
            const { placed, laneCount } = assignLanes(dayAppts)
            const isToday = isSameDay(day, today)

            return (
              <div
                key={day.toISOString()}
                className={cn("relative border-r last:border-r-0", isToday && "bg-primary/5")}
                style={{ height: TOTAL_HOURS * HOUR_HEIGHT }}
              >
                {/* Saat çizgileri */}
                {hours.map((h) => (
                  <div key={h} className="border-b" style={{ height: HOUR_HEIGHT }} />
                ))}

                {/* Randevular */}
                {placed.map(({ appt, lane }) => {
                  const start = new Date(appt.scheduledAt)
                  const minutesFromStart =
                    differenceInMinutes(start, dayStart) - DAY_START_HOUR * 60
                  const top = (minutesFromStart / 60) * HOUR_HEIGHT
                  const height = Math.max((appt.duration / 60) * HOUR_HEIGHT - 2, 20)
                  const widthPct = 100 / laneCount
                  const cancelled = appt.status === "cancelled"
                  const noShow = appt.status === "no_show"

                  return (
                    <Link
                      key={appt.id}
                      href={`/patients/${appt.patient.id}`}
                      title={`${format(start, "HH:mm")} · ${appt.patient.firstName} ${appt.patient.lastName} · ${appt.doctor.name}`}
                      className={cn(
                        "absolute overflow-hidden rounded border px-1.5 py-1 text-[11px] leading-tight shadow-sm transition-opacity hover:z-10 hover:shadow-md",
                        TYPE_COLORS[appt.type] ?? TYPE_COLORS.other,
                        (cancelled || noShow) && "opacity-50 line-through"
                      )}
                      style={{
                        top: Math.max(top, 0),
                        height,
                        left: `calc(${lane * widthPct}% + 2px)`,
                        width: `calc(${widthPct}% - 4px)`,
                      }}
                    >
                      <div className="font-semibold truncate">
                        {format(start, "HH:mm")} {appt.patient.firstName} {appt.patient.lastName}
                      </div>
                      {height > 34 && (
                        <div className="truncate opacity-80">
                          {labels.typeLabels[appt.type] ?? appt.type} · {appt.doctor.name}
                        </div>
                      )}
                    </Link>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
