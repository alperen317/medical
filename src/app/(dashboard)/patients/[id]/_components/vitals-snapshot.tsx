import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity } from "lucide-react"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { cn } from "@/lib/utils"
import type { LabValue } from "@/lib/ai/lab-report"

export type VitalItem = {
  name: string
  value: string
  unit: string
  status: LabValue["status"]
  date: Date
}

const STATUS_STYLE: Record<LabValue["status"], { dot: string; text: string; label: string }> = {
  normal:   { dot: "bg-green-500", text: "text-foreground",                     label: "Normal" },
  high:     { dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-400",  label: "Yüksek" },
  low:      { dot: "bg-blue-500",  text: "text-blue-700 dark:text-blue-400",    label: "Düşük"  },
  critical: { dot: "bg-red-500",   text: "text-red-700 dark:text-red-400",      label: "Kritik" },
}

export function VitalsSnapshot({ items }: { items: VitalItem[] }) {
  return (
    <Card>
      <CardHeader className="pb-2 px-5 pt-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
          <Activity className="h-4 w-4 text-muted-foreground" />
          Son Ölçümler
        </CardTitle>
        <p className="text-[11px] text-muted-foreground">Referans dışı / kritik değerler</p>
      </CardHeader>
      <CardContent className="px-5 pb-4 space-y-1.5">
        {items.length === 0 ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground py-2">
            <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
            Anormal değer yok — son ölçümler referans aralığında.
          </p>
        ) : (
          items.map((v, i) => {
            const s = STATUS_STYLE[v.status]
            return (
              <div
                key={`${v.name}-${i}`}
                className="flex items-center justify-between gap-2 rounded-md bg-muted/30 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{v.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {format(v.date, "d MMM yyyy", { locale: tr })}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={cn("text-sm font-semibold tabular-nums", s.text)}>
                    {v.value}
                    {v.unit && (
                      <span className="text-xs font-normal text-muted-foreground ml-0.5">{v.unit}</span>
                    )}
                  </span>
                  <span
                    className={cn("h-2 w-2 rounded-full shrink-0", s.dot)}
                    title={s.label}
                    aria-label={s.label}
                  />
                </div>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
