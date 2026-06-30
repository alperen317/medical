"use client"

import { useState, useTransition } from "react"
import { ChevronDown, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { updatePatientStatusAction } from "@/lib/actions/patients"
import { toast } from "@/store/ui.store"
import type { PatientStatus } from "@/generated/prisma/enums"
import { cn } from "@/lib/utils"
import { useT } from "@/store/translations-context"

const STATUS_STYLES: Record<PatientStatus, { dotClass: string; textClass: string }> = {
  active:     { dotClass: "bg-green-500", textClass: "text-green-700 dark:text-green-400" },
  inactive:   { dotClass: "bg-slate-400", textClass: "text-slate-600 dark:text-slate-400" },
  critical:   { dotClass: "bg-red-500",   textClass: "text-red-700 dark:text-red-400"     },
  discharged: { dotClass: "bg-blue-500",  textClass: "text-blue-700 dark:text-blue-400"   },
}

const STATUS_VALUES: PatientStatus[] = ["active", "inactive", "critical", "discharged"]

export function PatientStatusSelect({
  patientId,
  currentStatus,
}: {
  patientId: string
  currentStatus: PatientStatus
}) {
  const t = useT()
  const [status, setStatus] = useState<PatientStatus>(currentStatus)
  const [isPending, startTransition] = useTransition()

  const STATUS_OPTIONS = STATUS_VALUES.map((value) => ({
    value,
    label: t(`status.patient.${value}` as Parameters<typeof t>[0]),
    ...STATUS_STYLES[value],
  }))

  const current = STATUS_OPTIONS.find((o) => o.value === status)!

  function handleChange(next: PatientStatus) {
    if (next === status) return
    const prev = status
    setStatus(next)

    startTransition(async () => {
      const result = await updatePatientStatusAction(patientId, next)
      if (result.success) {
        const nextLabel = STATUS_OPTIONS.find((o) => o.value === next)?.label ?? next
        toast.success(`${t("common.status")}: "${nextLabel}"`)
      } else {
        setStatus(prev)
        toast.error(result.message)
      }
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" disabled={isPending}>
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <span className={cn("h-2 w-2 rounded-full shrink-0", current.dotClass)} />
          )}
          <span className={current.textClass}>{current.label}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {STATUS_OPTIONS.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onClick={() => handleChange(opt.value)}
            className={cn(
              "gap-2 cursor-pointer",
              opt.value === status && "font-semibold bg-muted/50"
            )}
          >
            <span className={cn("h-2 w-2 rounded-full shrink-0", opt.dotClass)} />
            <span className={opt.textClass}>{opt.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
