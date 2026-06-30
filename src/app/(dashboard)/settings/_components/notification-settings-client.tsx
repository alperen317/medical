"use client"

import { useActionState, useEffect } from "react"
import { Loader2, Check } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { updateNotificationSettingsAction } from "@/lib/actions/settings"
import type { NotificationSettings } from "@/lib/db/settings"
import { toast } from "@/store/ui.store"

type SettingRowProps = {
  id: string
  label: string
  description: string
  name: string
  defaultChecked: boolean
}

function SettingRow({ id, label, description, name, defaultChecked }: SettingRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-4 border-b last:border-b-0">
      <div className="flex-1 min-w-0">
        <label htmlFor={id} className="text-sm font-medium cursor-pointer">
          {label}
        </label>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <Switch id={id} name={name} value="true" defaultChecked={defaultChecked} />
    </div>
  )
}

type Props = {
  settings: NotificationSettings
  canManage: boolean
}

export function NotificationSettingsClient({ settings, canManage }: Props) {
  const [state, action, pending] = useActionState(updateNotificationSettingsAction, {})

  useEffect(() => {
    if (state?.success) toast.success(state.message ?? "Ayarlar kaydedildi.")
    else if (state?.message && !state.success) toast.error(state.message)
  }, [state])

  return (
    <form action={action}>
      <div className="divide-y divide-border">
        <div className="pb-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Randevu E-posta Bildirimleri
          </h3>
        </div>

        <SettingRow
          id="appt-doctor"
          name="appointmentDoctorEmail"
          label="Doktora e-posta gönder"
          description="Yeni randevu oluşturulduğunda atanan doktora e-posta bildirimi gönderilir."
          defaultChecked={settings.appointmentDoctorEmail}
        />
        <SettingRow
          id="appt-patient"
          name="appointmentPatientEmail"
          label="Hastaya e-posta gönder"
          description="Yeni randevu oluşturulduğunda hastaya onay e-postası gönderilir (e-posta adresi kayıtlıysa)."
          defaultChecked={settings.appointmentPatientEmail}
        />
        <SettingRow
          id="appt-status-doctor"
          name="appointmentStatusDoctorEmail"
          label="Durum değişikliğinde doktora bildir"
          description="Randevu tamamlandığında veya iptal edildiğinde doktora e-posta gönderilir."
          defaultChecked={settings.appointmentStatusDoctorEmail}
        />
      </div>

      {canManage && (
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
      )}
    </form>
  )
}
