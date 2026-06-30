"use client"

import { useActionState, useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Plus, Loader2, Pill } from "lucide-react"
import { cn } from "@/lib/utils"
import { createPrescriptionAction, type PrescriptionFormState } from "@/lib/actions/prescriptions"
import { toast } from "@/store/ui.store"
import { useT } from "@/store/translations-context"
import { format } from "date-fns"

const inputClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"

function FieldError({ errors, field }: { errors?: Record<string, string[]>; field: string }) {
  const msgs = errors?.[field]
  if (!msgs?.length) return null
  return <p className="text-xs text-destructive mt-1">{msgs[0]}</p>
}

function FrequencySelect({ name, options, otherLabel, customPlaceholder }: {
  name: string
  options: string[]
  otherLabel: string
  customPlaceholder: string
}) {
  const [value, setValue] = useState(options[0])
  const [custom, setCustom] = useState(false)

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={value} />
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => { setValue(opt); setCustom(false) }}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              value === opt && !custom
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input hover:bg-muted"
            )}
          >
            {opt}
          </button>
        ))}
        <button
          type="button"
          onClick={() => { setCustom(true); setValue("") }}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            custom ? "border-primary bg-primary text-primary-foreground" : "border-input hover:bg-muted"
          )}
        >
          {otherLabel}
        </button>
      </div>
      {custom && (
        <Input
          placeholder={customPlaceholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
        />
      )}
    </div>
  )
}

export function AddPrescriptionDialog({ patientId }: { patientId: string }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const [state, action, pending] = useActionState<PrescriptionFormState, FormData>(
    createPrescriptionAction,
    {}
  )

  const FREQUENCY_OPTS = [
    t("prescription.frequency.once_daily"),
    t("prescription.frequency.twice_daily"),
    t("prescription.frequency.three_daily"),
    t("prescription.frequency.four_daily"),
    t("prescription.frequency.as_needed"),
    t("prescription.frequency.weekly"),
  ]

  const DURATION_OPTS = [
    t("prescription.duration.3_days"),
    t("prescription.duration.5_days"),
    t("prescription.duration.7_days"),
    t("prescription.duration.10_days"),
    t("prescription.duration.14_days"),
    t("prescription.duration.21_days"),
    t("prescription.duration.30_days"),
    t("prescription.duration.indefinite"),
  ]

  useEffect(() => {
    if (state.success) {
      toast.success(t("prescription.toast.created"))
      setOpen(false)
      setFormKey((k) => k + 1)
    }
  }, [state])

  const todayValue = format(new Date(), "yyyy-MM-dd")

  return (
    <>
      <Button size="sm" className="gap-2" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        {t("prescription.new.button")}
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setFormKey((k) => k + 1) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pill className="h-4 w-4 text-teal-600" />
              {t("prescription.new.title")}
            </DialogTitle>
          </DialogHeader>

          <form key={formKey} action={action} className="space-y-4 pt-1">
            <input type="hidden" name="patientId" value={patientId} />

            {state.message && !state.success && (
              <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">
                {state.message}
              </p>
            )}

            <div className="space-y-1.5">
              <label htmlFor="medication" className="text-sm font-medium">
                {t("prescription.field.medication")} <span className="text-destructive">*</span>
              </label>
              <Input
                id="medication"
                name="medication"
                placeholder={t("prescription.medication.placeholder")}
                autoFocus
              />
              <FieldError errors={state.errors} field="medication" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="dosage" className="text-sm font-medium">
                  {t("prescription.field.dosage")} <span className="text-destructive">*</span>
                </label>
                <Input
                  id="dosage"
                  name="dosage"
                  placeholder={t("prescription.dosage.placeholder")}
                />
                <FieldError errors={state.errors} field="dosage" />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="prescribedAt" className="text-sm font-medium">
                  {t("prescription.field.date")} <span className="text-destructive">*</span>
                </label>
                <Input
                  id="prescribedAt"
                  name="prescribedAt"
                  type="date"
                  defaultValue={todayValue}
                />
                <FieldError errors={state.errors} field="prescribedAt" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {t("prescription.field.frequency")} <span className="text-destructive">*</span>
              </label>
              <FrequencySelect
                name="frequency"
                options={FREQUENCY_OPTS}
                otherLabel={t("prescription.other_option")}
                customPlaceholder={t("prescription.custom_placeholder")}
              />
              <FieldError errors={state.errors} field="frequency" />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {t("prescription.field.duration")} <span className="text-destructive">*</span>
              </label>
              <FrequencySelect
                name="duration"
                options={DURATION_OPTS}
                otherLabel={t("prescription.other_option")}
                customPlaceholder={t("prescription.custom_placeholder")}
              />
              <FieldError errors={state.errors} field="duration" />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="instructions" className="text-sm font-medium">
                {t("prescription.field.instructions")}
                <span className="text-muted-foreground font-normal text-xs ml-1">{t("patient.form.optional")}</span>
              </label>
              <textarea
                id="instructions"
                name="instructions"
                rows={2}
                placeholder={t("prescription.instructions.placeholder")}
                className={cn(inputClass, "min-h-16 py-2 resize-none bg-background")}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t("action.cancel")}
              </Button>
              <Button type="submit" disabled={pending} className="gap-2 min-w-36">
                {pending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />{t("action.saving")}</>
                ) : (
                  t("prescription.submit")
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
