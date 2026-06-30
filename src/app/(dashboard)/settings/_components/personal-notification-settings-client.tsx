"use client"

import { useActionState, useEffect } from "react"
import { Loader2, Check } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { updateMyNotificationPreferencesAction } from "@/lib/actions/settings"
import { toast } from "@/store/ui.store"

const STATUS_OPTIONS: { value: string; label: string; description: string }[] = [
  { value: "critical",   label: "Kritik",  description: "Atandığım hasta KRİTİK duruma geçtiğinde." },
  { value: "discharged", label: "Taburcu", description: "Atandığım hasta taburcu edildiğinde." },
  { value: "active",     label: "Aktif",   description: "Atandığım hasta aktif duruma geçtiğinde." },
  { value: "inactive",   label: "Pasif",   description: "Atandığım hasta pasif duruma geçtiğinde." },
]

const ACTION_OPTIONS: { value: string; label: string; description: string }[] = [
  { value: "report_added",        label: "Rapor Eklendi",   description: "Atandığım hastaya belge/rapor yüklendiğinde." },
  { value: "prescription_added",  label: "Reçete Eklendi",  description: "Atandığım hastaya reçete yazıldığında." },
]

type Props = {
  selectedStatuses: string[]
  selectedActions: string[]
}

export function PersonalNotificationSettingsClient({ selectedStatuses, selectedActions }: Props) {
  const [state, action, pending] = useActionState(updateMyNotificationPreferencesAction, {})

  useEffect(() => {
    if (state?.success) toast.success(state.message ?? "Kaydedildi.")
    else if (state?.message && !state.success) toast.error(state.message)
  }, [state])

  return (
    <form action={action}>
      <div className="divide-y divide-border">
        {STATUS_OPTIONS.map((opt) => (
          <div key={opt.value} className="flex items-start justify-between gap-4 py-4">
            <div className="flex-1 min-w-0">
              <label htmlFor={`status-${opt.value}`} className="text-sm font-medium cursor-pointer">
                {opt.label}
              </label>
              <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
            </div>
            <Switch
              id={`status-${opt.value}`}
              name={`status.${opt.value}`}
              value="true"
              defaultChecked={selectedStatuses.includes(opt.value)}
            />
          </div>
        ))}
      </div>

      <div className="mt-2 pt-4 border-t border-border">
        <p className="text-sm font-medium mb-1">Hasta Aksiyonları</p>
        <p className="text-xs text-muted-foreground mb-2">
          Atandığım hasta üzerinde aşağıdaki işlemler yapıldığında e-posta ile bilgilendirilirim.
        </p>
        {ACTION_OPTIONS.map((opt) => (
          <div key={opt.value} className="flex items-start justify-between gap-4 py-4">
            <div className="flex-1 min-w-0">
              <label htmlFor={`action-${opt.value}`} className="text-sm font-medium cursor-pointer">
                {opt.label}
              </label>
              <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
            </div>
            <Switch
              id={`action-${opt.value}`}
              name={`action.${opt.value}`}
              value="true"
              defaultChecked={selectedActions.includes(opt.value)}
            />
          </div>
        ))}
      </div>

      <div className="flex justify-end pt-5">
        <Button type="submit" disabled={pending} className="min-w-28">
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : state?.success ? (
            <><Check className="h-4 w-4 mr-1.5" />Kaydedildi</>
          ) : (
            "Kaydet"
          )}
        </Button>
      </div>
    </form>
  )
}
