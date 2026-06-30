import nodemailer from "nodemailer"

// Brevo (Sendinblue) SMTP relay — https://developers.brevo.com/docs/smtp-integration
const transport = nodemailer.createTransport({
  host: process.env.BREVO_SMTP_HOST ?? "smtp-relay.brevo.com",
  port: Number(process.env.BREVO_SMTP_PORT ?? 587),
  secure: false, // 587 = STARTTLS
  auth: {
    user: process.env.BREVO_SMTP_USER,
    pass: process.env.BREVO_SMTP_KEY,
  },
})

const SENDER = {
  // Brevo'da doğrulanmış bir gönderici adresi olmalı (Senders & IP > Senders)
  address: process.env.MAIL_FROM_ADDRESS ?? "noreply@yeditepe.com",
  name: process.env.MAIL_FROM_NAME ?? "Yeditepe Hasta Yönetim Paneli AI Projesi",
}

export async function sendPasswordResetEmail({
  to,
  name,
  resetLink,
}: {
  to: string
  name: string
  resetLink: string
}) {
  await transport.sendMail({
    from: SENDER,
    to,
    subject: "Yeditepe — Şifre Sıfırlama",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff">
        <h2 style="color:#0f172a;margin-bottom:8px">Şifre Sıfırlama</h2>
        <p style="color:#64748b;margin-bottom:8px">
          Merhaba ${name}, hesabınız için şifre sıfırlama talebinde bulunuldu.
          Yeni şifrenizi belirlemek için aşağıdaki butona tıklayın.
        </p>
        <p style="color:#94a3b8;font-size:12px;margin-bottom:24px">
          Bu link 1 saat geçerlidir. Eğer bu talebi siz yapmadıysanız bu e-postayı görmezden gelebilirsiniz.
        </p>

        <a href="${resetLink}"
           style="display:inline-block;background:#2563eb;color:#fff;font-weight:600;font-size:14px;
                  padding:12px 24px;border-radius:8px;text-decoration:none;margin-bottom:24px">
          Şifremi Sıfırla
        </a>

        <p style="color:#94a3b8;font-size:12px;border-top:1px solid #e2e8f0;padding-top:16px;margin-top:8px">
          Butona tıklayamıyorsanız şu linki tarayıcınıza yapıştırın:<br/>
          <span style="color:#2563eb;word-break:break-all">${resetLink}</span>
        </p>
      </div>
    `,
    headers: { "X-Mailin-Tag": "Şifre Sıfırlama" },
  })
}

const STATUS_LABELS: Record<string, string> = {
  active: "Aktif",
  inactive: "Pasif",
  critical: "Kritik",
  discharged: "Taburcu",
}

export async function sendDoctorAssignmentEmail({
  to,
  doctorName,
  patient,
  patientLink,
}: {
  to: string
  doctorName: string
  patient: {
    firstName: string
    lastName: string
    dateOfBirth: Date
    status: string
    emergencyContactName?: string | null
    emergencyContactPhone?: string | null
    emergencyContactRelation?: string | null
  }
  patientLink: string
}) {
  const dob = patient.dateOfBirth.toLocaleDateString("tr-TR", {
    day: "2-digit", month: "long", year: "numeric",
  })
  const statusLabel = STATUS_LABELS[patient.status] ?? patient.status

  const emergencyRow = patient.emergencyContactName
    ? `
      <tr>
        <td style="color:#64748b;padding:4px 0;width:140px">Acil İletişim</td>
        <td style="color:#0f172a;padding:4px 0">
          ${patient.emergencyContactName}
          ${patient.emergencyContactRelation ? `(${patient.emergencyContactRelation})` : ""}
          ${patient.emergencyContactPhone ? `· ${patient.emergencyContactPhone}` : ""}
        </td>
      </tr>`
    : ""

  await transport.sendMail({
    from: SENDER,
    to,
    subject: `Yeditepe — Yeni Hasta Ataması: ${patient.firstName} ${patient.lastName}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#fff">
        <h2 style="color:#0f172a;margin-bottom:4px">Yeni Hasta Ataması</h2>
        <p style="color:#64748b;margin-bottom:24px">
          Merhaba ${doctorName}, aşağıdaki hasta size atandı.
        </p>

        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin-bottom:24px">
          <p style="font-size:18px;font-weight:700;color:#0f172a;margin:0 0 16px 0">
            ${patient.firstName} ${patient.lastName}
          </p>
          <table style="border-collapse:collapse;width:100%;font-size:14px">
            <tr>
              <td style="color:#64748b;padding:4px 0;width:140px">Doğum Tarihi</td>
              <td style="color:#0f172a;padding:4px 0">${dob}</td>
            </tr>
            <tr>
              <td style="color:#64748b;padding:4px 0">Durum</td>
              <td style="padding:4px 0">
                <span style="display:inline-block;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:600;
                  background:${patient.status === "critical" ? "#fee2e2" : patient.status === "active" ? "#dcfce7" : "#f1f5f9"};
                  color:${patient.status === "critical" ? "#991b1b" : patient.status === "active" ? "#166534" : "#475569"}">
                  ${statusLabel}
                </span>
              </td>
            </tr>
            ${emergencyRow}
          </table>
        </div>

        <a href="${patientLink}"
           style="display:inline-block;background:#2563eb;color:#fff;font-weight:600;font-size:14px;
                  padding:12px 24px;border-radius:8px;text-decoration:none;margin-bottom:24px">
          Hasta Profilini Görüntüle
        </a>

        <p style="color:#94a3b8;font-size:12px;border-top:1px solid #e2e8f0;padding-top:16px;margin-top:8px">
          Bu bildirimi Yeditepe Hasta Yönetim Paneli AI Projesi gönderdi.
        </p>
      </div>
    `,
    headers: { "X-Mailin-Tag": "Hasta Ataması" },
  })
}

function statusBadge(status: string): string {
  const label = STATUS_LABELS[status] ?? status
  const bg = status === "critical" ? "#fee2e2" : status === "active" ? "#dcfce7" : "#f1f5f9"
  const fg = status === "critical" ? "#991b1b" : status === "active" ? "#166534" : "#475569"
  return `<span style="display:inline-block;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:600;background:${bg};color:${fg}">${label}</span>`
}

export async function sendPatientStatusEmail({
  to,
  doctorName,
  patientName,
  oldStatus,
  newStatus,
  patientLink,
}: {
  to: string
  doctorName: string
  patientName: string
  oldStatus: string
  newStatus: string
  patientLink: string
}) {
  const newLabel = STATUS_LABELS[newStatus] ?? newStatus
  await transport.sendMail({
    from: SENDER,
    to,
    subject: `Yeditepe — Hasta Durumu Değişti: ${patientName} (${newLabel})`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#fff">
        <h2 style="color:#0f172a;margin-bottom:4px">Hasta Durumu Değişti</h2>
        <p style="color:#64748b;margin-bottom:24px">
          Merhaba ${doctorName}, size atanmış olan hastanın durumu güncellendi.
        </p>

        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin-bottom:24px">
          <p style="font-size:18px;font-weight:700;color:#0f172a;margin:0 0 16px 0">${patientName}</p>
          <table style="border-collapse:collapse;width:100%;font-size:14px">
            <tr>
              <td style="color:#64748b;padding:6px 0;width:140px">Önceki Durum</td>
              <td style="padding:6px 0">${statusBadge(oldStatus)}</td>
            </tr>
            <tr>
              <td style="color:#64748b;padding:6px 0">Yeni Durum</td>
              <td style="padding:6px 0">${statusBadge(newStatus)}</td>
            </tr>
          </table>
        </div>

        <a href="${patientLink}"
           style="display:inline-block;background:#2563eb;color:#fff;font-weight:600;font-size:14px;
                  padding:12px 24px;border-radius:8px;text-decoration:none;margin-bottom:24px">
          Hasta Profilini Görüntüle
        </a>

        <p style="color:#94a3b8;font-size:12px;border-top:1px solid #e2e8f0;padding-top:16px;margin-top:8px">
          Bu bildirimi, bildirim tercihlerinizde bu durumu seçtiğiniz için aldınız. Tercihlerinizi Ayarlar > Kişisel Bildirim Tercihleri'nden değiştirebilirsiniz.
        </p>
      </div>
    `,
    headers: { "X-Mailin-Tag": "Hasta Durumu" },
  })
}

const TYPE_LABELS: Record<string, string> = {
  consultation: "Muayene",
  follow_up:    "Kontrol",
  procedure:    "Prosedür",
  lab:          "Tahlil",
  other:        "Diğer",
}

export async function sendPatientActionEmail({
  to,
  doctorName,
  patientName,
  actionLabel,
  actionDescription,
  patientLink,
}: {
  to: string
  doctorName: string
  patientName: string
  actionLabel: string
  actionDescription: string
  patientLink: string
}) {
  await transport.sendMail({
    from: SENDER,
    to,
    subject: `Yeditepe — ${patientName}: ${actionLabel}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#fff">
        <h2 style="color:#0f172a;margin-bottom:4px">Hasta Aksiyonu</h2>
        <p style="color:#64748b;margin-bottom:24px">
          Merhaba ${doctorName}, size atanmış olan hastanın kaydına yeni bir işlem eklendi.
        </p>

        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin-bottom:24px">
          <p style="font-size:18px;font-weight:700;color:#0f172a;margin:0 0 16px 0">${patientName}</p>
          <table style="border-collapse:collapse;width:100%;font-size:14px">
            <tr>
              <td style="color:#64748b;padding:6px 0;width:140px">İşlem</td>
              <td style="color:#0f172a;font-weight:600;padding:6px 0">${actionLabel}</td>
            </tr>
            <tr>
              <td style="color:#64748b;padding:6px 0;vertical-align:top">Detay</td>
              <td style="color:#475569;padding:6px 0">${actionDescription}</td>
            </tr>
          </table>
        </div>

        <a href="${patientLink}"
           style="display:inline-block;background:#2563eb;color:#fff;font-weight:600;font-size:14px;
                  padding:12px 24px;border-radius:8px;text-decoration:none;margin-bottom:24px">
          Hasta Profilini Görüntüle
        </a>

        <p style="color:#94a3b8;font-size:12px;border-top:1px solid #e2e8f0;padding-top:16px">
          Bu bildirimi, bildirim tercihlerinizde bu aksiyonu seçtiğiniz için aldınız. Tercihlerinizi Ayarlar &gt; Kişisel Bildirim Tercihleri'nden değiştirebilirsiniz.
        </p>
      </div>
    `,
    headers: { "X-Mailin-Tag": "Hasta Aksiyonu" },
  })
}

export async function sendAppointmentEmail({
  to,
  recipientName,
  patientName,
  doctorName,
  scheduledAt,
  duration,
  type,
  notes,
}: {
  to: string
  recipientName: string
  patientName: string
  doctorName: string
  scheduledAt: Date
  duration: number
  type: string
  notes?: string
}) {
  const dateStr = scheduledAt.toLocaleDateString("tr-TR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  })
  const timeStr = scheduledAt.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
  const typeLabel = TYPE_LABELS[type] ?? type

  await transport.sendMail({
    from: SENDER,
    to,
    subject: `Yeditepe — Randevu Bildirimi: ${patientName}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#fff">
        <h2 style="color:#0f172a;margin-bottom:4px">Randevu Bildirimi</h2>
        <p style="color:#64748b;margin-bottom:24px">Merhaba ${recipientName},</p>

        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin-bottom:24px">
          <table style="border-collapse:collapse;width:100%;font-size:14px">
            <tr>
              <td style="color:#64748b;padding:6px 0;width:120px">Hasta</td>
              <td style="color:#0f172a;font-weight:600;padding:6px 0">${patientName}</td>
            </tr>
            <tr>
              <td style="color:#64748b;padding:6px 0">Doktor</td>
              <td style="color:#0f172a;padding:6px 0">${doctorName}</td>
            </tr>
            <tr>
              <td style="color:#64748b;padding:6px 0">Tarih</td>
              <td style="color:#0f172a;padding:6px 0">${dateStr}</td>
            </tr>
            <tr>
              <td style="color:#64748b;padding:6px 0">Saat</td>
              <td style="color:#0f172a;padding:6px 0">${timeStr}</td>
            </tr>
            <tr>
              <td style="color:#64748b;padding:6px 0">Süre</td>
              <td style="color:#0f172a;padding:6px 0">${duration} dakika</td>
            </tr>
            <tr>
              <td style="color:#64748b;padding:6px 0">Tür</td>
              <td style="padding:6px 0">
                <span style="display:inline-block;background:#dbeafe;color:#1e40af;font-size:12px;font-weight:600;padding:2px 10px;border-radius:999px">
                  ${typeLabel}
                </span>
              </td>
            </tr>
            ${notes ? `
            <tr>
              <td style="color:#64748b;padding:6px 0;vertical-align:top">Notlar</td>
              <td style="color:#475569;padding:6px 0">${notes}</td>
            </tr>` : ""}
          </table>
        </div>

        <p style="color:#94a3b8;font-size:12px;border-top:1px solid #e2e8f0;padding-top:16px">
          Bu bildirimi Yeditepe Hasta Yönetim Paneli AI Projesi gönderdi.
        </p>
      </div>
    `,
    headers: { "X-Mailin-Tag": "Randevu Bildirimi" },
  })
}

export async function sendSetupEmail({
  to,
  name,
  roleName,
  setupLink,
}: {
  to: string
  name: string
  roleName: string
  setupLink: string
}) {
  await transport.sendMail({
    from: SENDER,
    to,
    subject: "Yeditepe — Hesabınızı Aktif Edin",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff">
        <h2 style="color:#0f172a;margin-bottom:8px">Hoş geldiniz, ${name}</h2>
        <p style="color:#64748b;margin-bottom:8px">
          Yeditepe Hasta Yönetim Paneli AI Projesi'ne <strong>${roleName}</strong> rolüyle davet edildiniz.
          Hesabınızı etkinleştirmek ve şifrenizi belirlemek için aşağıdaki butona tıklayın.
        </p>
        <p style="color:#94a3b8;font-size:12px;margin-bottom:24px">
          Bu link 48 saat geçerlidir.
        </p>

        <a href="${setupLink}"
           style="display:inline-block;background:#2563eb;color:#fff;font-weight:600;font-size:14px;
                  padding:12px 24px;border-radius:8px;text-decoration:none;margin-bottom:24px">
          Şifremi Belirle
        </a>

        <p style="color:#94a3b8;font-size:12px;border-top:1px solid #e2e8f0;padding-top:16px;margin-top:8px">
          Butona tıklayamıyorsanız şu linki tarayıcınıza yapıştırın:<br/>
          <span style="color:#2563eb;word-break:break-all">${setupLink}</span>
        </p>
      </div>
    `,
    headers: { "X-Mailin-Tag": "Kullanıcı Davet" },
  })
}
