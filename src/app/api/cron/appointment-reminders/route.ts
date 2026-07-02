import { NextResponse } from "next/server"
import { getDueReminders, markReminderSent } from "@/lib/db/appointments"
import { createNotification } from "@/lib/db/notifications"
import { getNotificationSettings } from "@/lib/db/settings"
import { sendAppointmentEmail } from "@/lib/mailer"
import { logActivity } from "@/lib/db/activity"

// Randevu hatırlatma penceresi (saat). Randevudan bu kadar süre önce hatırlatma gönderilir.
const REMINDER_WINDOW_HOURS = 24

export const dynamic = "force-dynamic"

/**
 * Zamanlanmış görev (cron) uç noktası: yaklaşan randevular için hatırlatma gönderir.
 * `CRON_SECRET` env değişkeni ile korunur:
 *   Authorization: Bearer <CRON_SECRET>  veya  ?secret=<CRON_SECRET>
 *
 * Önerilen kullanım: harici bir cron servisi (ör. cron-job.org / sistem crontab) her saat başı çağırır.
 *   0 * * * *  curl -s -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/appointment-reminders
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get("authorization")
    const url = new URL(request.url)
    const provided = auth?.replace(/^Bearer\s+/i, "") ?? url.searchParams.get("secret")
    if (provided !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }
  }

  const now = new Date()
  const settings = await getNotificationSettings()
  const due = await getDueReminders(now, REMINDER_WINDOW_HOURS)

  let notified = 0
  let emailed = 0

  for (const appt of due) {
    const patientName = `${appt.patient.firstName} ${appt.patient.lastName}`
    const dateStr = new Intl.DateTimeFormat("tr-TR", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    }).format(new Date(appt.scheduledAt))

    // 1) Doktora uygulama içi hatırlatma bildirimi
    try {
      await createNotification({
        userId: appt.doctor.id,
        type: "appointment_reminder",
        title: "Randevu Hatırlatması",
        body: `${patientName} ile ${dateStr} tarihinde randevunuz var.`,
        entityType: "appointment",
        entityId: appt.id,
      })
      notified++
    } catch (err) {
      console.error("[cron] reminder notification failed:", err)
    }

    // 2) Hastaya e-posta hatırlatması (ayar açıksa ve e-posta varsa)
    if (settings.appointmentReminderPatientEmail && appt.patient.email) {
      try {
        await sendAppointmentEmail({
          to: appt.patient.email,
          recipientName: patientName,
          patientName,
          doctorName: appt.doctor.name,
          scheduledAt: new Date(appt.scheduledAt),
          duration: appt.duration,
          type: appt.type,
          notes: appt.notes ?? undefined,
          variant: "reminder",
        })
        emailed++
      } catch (err) {
        console.error("[cron] reminder email failed:", err)
      }
    }

    // 3) Tekrarı önlemek için işaretle
    await markReminderSent(appt.id).catch((err) =>
      console.error("[cron] markReminderSent failed:", err)
    )

    void logActivity({
      action: "appointment.reminder_sent",
      entityType: "appointment",
      entityId: appt.id,
      entityLabel: `${patientName} — ${appt.doctor.name}`,
      metadata: { scheduledAt: appt.scheduledAt, emailed: Boolean(settings.appointmentReminderPatientEmail && appt.patient.email) },
    }).catch(console.error)
  }

  return NextResponse.json({
    ok: true,
    processed: due.length,
    notified,
    emailed,
    windowHours: REMINDER_WINDOW_HOURS,
  })
}
