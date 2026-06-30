import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Bell, BellRing } from "lucide-react"
import { verifySession } from "@/lib/dal"
import { getNotificationSettings } from "@/lib/db/settings"
import { getUserNotifyStatuses, getUserNotifyActions } from "@/lib/db/users"
import { NotificationSettingsClient } from "./_components/notification-settings-client"
import { PersonalNotificationSettingsClient } from "./_components/personal-notification-settings-client"

export default async function SettingsPage() {
  const session = await verifySession()
  const canManage = session.permissions.includes("settings:manage")

  const [settings, myNotifyStatuses, myNotifyActions] = await Promise.all([
    getNotificationSettings(),
    getUserNotifyStatuses(session.userId),
    getUserNotifyActions(session.userId),
  ])

  return (
    <div>
      <Header title="Sistem Ayarları" subtitle="Bildirim ve sistem tercihleri" />
      <div className="p-6 space-y-6">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">E-posta Bildirimleri</CardTitle>
            </div>
            <CardDescription>
              Sistem tarafından otomatik gönderilen e-posta bildirimlerini yapılandırın.
              {!canManage && (
                <span className="block mt-1 text-[var(--status-warning-fg)]">
                  Bu ayarları değiştirmek için yönetici yetkisi gereklidir.
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <fieldset disabled={!canManage} className="disabled:opacity-60 disabled:cursor-not-allowed">
              <NotificationSettingsClient settings={settings} canManage={canManage} />
            </fieldset>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <BellRing className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Kişisel Bildirim Tercihleri</CardTitle>
            </div>
            <CardDescription>
              Size atanmış bir hastanın durumu değiştiğinde, belge/rapor yüklendiğinde veya reçete yazıldığında e-posta ile bilgilendirilirsiniz.
              Bu tercihler yalnızca sizin hesabınız içindir.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PersonalNotificationSettingsClient selectedStatuses={myNotifyStatuses} selectedActions={myNotifyActions} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
