"use client"

import { useActionState, useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Plus, Loader2, Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { createAppointmentAction, type AppointmentFormState } from "@/lib/actions/appointments"
import { toast } from "@/store/ui.store"
import { useT } from "@/store/translations-context"

type Doctor = { id: string; name: string; roleLabel: string }
type Patient = { id: string; firstName: string; lastName: string; phone: string }

const DURATION_OPTS = [15, 30, 45, 60]

const inputClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"

function FieldError({ errors, field }: { errors?: Record<string, string[]>; field: string }) {
  const msgs = errors?.[field]
  if (!msgs?.length) return null
  return <p className="text-xs text-destructive mt-1">{msgs[0]}</p>
}

export function NewAppointmentButton({
  doctors,
  patients,
}: {
  doctors: Doctor[]
  patients: Patient[]
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState<AppointmentFormState, FormData>(
    createAppointmentAction,
    {}
  )
  const [type, setType] = useState<string>("consultation")
  const [duration, setDuration] = useState(30)
  const [selectedPatientId, setSelectedPatientId] = useState("")
  const [patientSearch, setPatientSearch] = useState("")
  const [showPatientList, setShowPatientList] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const patientRef = useRef<HTMLDivElement>(null)

  const TYPE_OPTS = [
    { value: "consultation", label: t("type.appointment.consultation") },
    { value: "follow_up",    label: t("type.appointment.follow_up") },
    { value: "procedure",    label: t("type.appointment.procedure") },
    { value: "lab",          label: t("type.appointment.lab") },
    { value: "other",        label: t("type.appointment.other") },
  ] as const

  const selectedPatient = patients.find((p) => p.id === selectedPatientId)

  const filteredPatients = patientSearch
    ? patients.filter((p) =>
        `${p.firstName} ${p.lastName} ${p.phone}`.toLowerCase().includes(patientSearch.toLowerCase())
      )
    : patients.slice(0, 8)

  useEffect(() => {
    if (state.success) {
      toast.success(t("appointment.toast.created"))
      setOpen(false)
      resetForm()
    }
  }, [state])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (patientRef.current && !patientRef.current.contains(e.target as Node)) {
        setShowPatientList(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  function resetForm() {
    setType("consultation")
    setDuration(30)
    setSelectedPatientId("")
    setPatientSearch("")
    setFormKey((k) => k + 1)
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className="gap-2">
        <Plus className="h-4 w-4" />
        {t("appointment.new.button")}
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm() }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("appointment.new.title")}</DialogTitle>
          </DialogHeader>

          <form key={formKey} action={action} className="space-y-4 pt-2">
            <input type="hidden" name="type" value={type} />
            <input type="hidden" name="duration" value={duration} />
            <input type="hidden" name="patientId" value={selectedPatientId} />

            {state.message && !state.success && (
              <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">
                {state.message}
              </p>
            )}

            {/* Hasta seçimi */}
            <div className="space-y-1.5" ref={patientRef}>
              <label className="text-sm font-medium">
                {t("appointment.field.patient")} <span className="text-destructive">*</span>
              </label>
              {selectedPatient ? (
                <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                  <span className="flex-1 font-medium">
                    {selectedPatient.firstName} {selectedPatient.lastName}
                  </span>
                  <span className="text-muted-foreground text-xs">{selectedPatient.phone}</span>
                  <button
                    type="button"
                    onClick={() => { setSelectedPatientId(""); setPatientSearch("") }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t("appointment.patient.placeholder")}
                    className="pl-8"
                    value={patientSearch}
                    onChange={(e) => { setPatientSearch(e.target.value); setShowPatientList(true) }}
                    onFocus={() => setShowPatientList(true)}
                  />
                  {showPatientList && filteredPatients.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
                      {filteredPatients.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className="flex w-full items-center gap-3 px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
                          onClick={() => {
                            setSelectedPatientId(p.id)
                            setPatientSearch("")
                            setShowPatientList(false)
                          }}
                        >
                          <span className="font-medium">{p.firstName} {p.lastName}</span>
                          <span className="text-muted-foreground text-xs">{p.phone}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <FieldError errors={state.errors} field="patientId" />
            </div>

            {/* Doktor seçimi */}
            <div className="space-y-1.5">
              <label htmlFor="doctorId" className="text-sm font-medium">
                {t("appointment.field.doctor")} <span className="text-destructive">*</span>
              </label>
              <select id="doctorId" name="doctorId" className={cn(inputClass, "bg-background")}>
                <option value="">{t("appointment.doctor.placeholder")}</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>{d.name} — {d.roleLabel}</option>
                ))}
              </select>
              <FieldError errors={state.errors} field="doctorId" />
            </div>

            {/* Tarih ve saat */}
            <div className="space-y-1.5">
              <label htmlFor="scheduledAt" className="text-sm font-medium">
                {t("appointment.field.datetime")} <span className="text-destructive">*</span>
              </label>
              <Input id="scheduledAt" name="scheduledAt" type="datetime-local" />
              <FieldError errors={state.errors} field="scheduledAt" />
            </div>

            {/* Süre */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("appointment.field.duration_label")}</label>
              <div className="flex gap-2">
                {DURATION_OPTS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDuration(d)}
                    className={cn(
                      "flex-1 rounded-md border py-1.5 text-sm font-medium transition-colors",
                      duration === d
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input hover:bg-muted"
                    )}
                  >
                    {d} {t("appointment.duration_unit")}
                  </button>
                ))}
              </div>
            </div>

            {/* Tip */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("appointment.type_label")}</label>
              <div className="flex flex-wrap gap-2">
                {TYPE_OPTS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setType(opt.value)}
                    className={cn(
                      "rounded-full px-3 py-1 text-sm font-medium border transition-colors",
                      type === opt.value
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input hover:bg-muted"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notlar */}
            <div className="space-y-1.5">
              <label htmlFor="notes" className="text-sm font-medium">{t("appointment.field.notes")}</label>
              <textarea
                id="notes"
                name="notes"
                rows={2}
                className={cn(inputClass, "min-h-16 py-2 resize-none bg-background")}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t("action.cancel")}
              </Button>
              <Button type="submit" disabled={pending || !selectedPatientId} className="gap-2 min-w-32">
                {pending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />{t("action.saving")}</>
                ) : (
                  t("appointment.submit")
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
