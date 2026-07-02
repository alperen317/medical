import { notFound } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Phone, Mail, MapPin, User, Droplets, AlertTriangle,
  Plus, FileText, Pill, TestTube, Stethoscope, StickyNote,
  Clipboard, Clock, ArrowLeft, Pencil,
} from "lucide-react"
import { CopyButton } from "./_components/copy-button"
import { PatientActions } from "./_components/patient-actions"
import { PatientStatusSelect } from "./_components/patient-status-select"
import { TimelineDeleteButton } from "./_components/timeline-delete-button"
import { TimelineDocumentButton } from "./_components/timeline-document-button"
import { AddPrescriptionDialog } from "./_components/add-prescription-dialog"
import { DocumentsSection } from "@/components/documents/documents-section"
import type { DocumentEvent } from "@/components/documents/documents-section"
import { ClinicalSummaryPanel, type AiSummaryData } from "@/components/ai/clinical-summary-panel"
import { BrainTumorPanel, TimelineBrainViewerButton } from "@/components/ai/brain-tumor-panel"
import type { BrainAnalysisSummary } from "@/lib/ai/brain-tumor"
import { getPatientById } from "@/lib/db/patients"
import { verifySession } from "@/lib/dal"
import { can } from "@/lib/permissions"
import type { TimelineEventType } from "@/generated/prisma/enums"
import { format, differenceInYears } from "date-fns"
import { tr } from "date-fns/locale"
import { getServerT } from "@/lib/i18n/server"

const bloodTypeLabels: Record<string, string> = {
  A_pos: "A+", A_neg: "A-", B_pos: "B+", B_neg: "B-",
  AB_pos: "AB+", AB_neg: "AB-", O_pos: "O+", O_neg: "O-",
}

const EVENT_ICONS: Record<TimelineEventType, React.ElementType> = {
  visit:        Stethoscope,
  diagnosis:    Clipboard,
  treatment:    FileText,
  note:         StickyNote,
  document:     FileText,
  prescription: Pill,
  lab:          TestTube,
}

const EVENT_STYLES: Record<TimelineEventType, { color: string; bgColor: string }> = {
  visit:        { color: "text-blue-600 dark:text-blue-400",   bgColor: "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/60" },
  diagnosis:    { color: "text-purple-600 dark:text-purple-400", bgColor: "bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-900/60" },
  treatment:    { color: "text-green-600 dark:text-green-400", bgColor: "bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-900/60" },
  note:         { color: "text-yellow-600 dark:text-yellow-400", bgColor: "bg-yellow-50 dark:bg-yellow-950/40 border-yellow-200 dark:border-yellow-900/60" },
  document:     { color: "text-orange-600 dark:text-orange-400", bgColor: "bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-900/60" },
  prescription: { color: "text-teal-600 dark:text-teal-400",  bgColor: "bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-900/60" },
  lab:          { color: "text-pink-600 dark:text-pink-400",   bgColor: "bg-pink-50 dark:bg-pink-950/40 border-pink-200 dark:border-pink-900/60" },
}

interface PatientDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function PatientDetailPage({ params }: PatientDetailPageProps) {
  const t = await getServerT()
  const { id } = await params
  const [patient, session] = await Promise.all([getPatientById(id), verifySession()])
  if (!patient) notFound()

  const canDeleteTimeline = can(session.permissions, "timeline:delete")

  const age = differenceInYears(new Date(), patient.dateOfBirth)
  const bloodLabel = patient.bloodType ? bloodTypeLabels[patient.bloodType] : null
  const genderLabel =
    patient.gender === "male" ? t("gender.male") :
    patient.gender === "female" ? t("gender.female") :
    t("gender.other")

  const eventLabels: Record<TimelineEventType, string> = {
    visit:        t("timeline.type.visit"),
    diagnosis:    t("timeline.type.diagnosis"),
    treatment:    t("timeline.type.treatment"),
    note:         t("timeline.type.note"),
    document:     t("timeline.type.document"),
    prescription: t("timeline.type.prescription"),
    lab:          t("timeline.type.lab"),
  }

  const diagnosisSeverity = {
    mild:     { label: t("diagnosis.severity.mild"),     variant: "success" as const },
    moderate: { label: t("diagnosis.severity.moderate"), variant: "warning" as const },
    severe:   { label: t("diagnosis.severity.severe"),   variant: "destructive" as const },
  }

  const diagnosisStatus = {
    active:   { label: t("diagnosis.status.active"),   variant: "info" as const },
    resolved: { label: t("diagnosis.status.resolved"), variant: "success" as const },
    chronic:  { label: t("diagnosis.status.chronic"),  variant: "warning" as const },
  }

  // Kalıcı beyin MR analizleri — Beyin MR sekmesinde geçmiş olarak gösterilir.
  const brainAnalyses: BrainAnalysisSummary[] = patient.timelineEvents
    .filter(
      (e) =>
        e.type === "document" &&
        (e.metadata as { analysisType?: string } | null)?.analysisType === "brain_tumor_segmentation",
    )
    .map((e) => {
      const m = e.metadata as {
        volumes?: { tc: number; wt: number; et: number }
        metrics?: BrainAnalysisSummary["metrics"]
        source?: string
        analysisFile?: string
      }
      return {
        id: e.id,
        date: e.date instanceof Date ? e.date.toISOString() : String(e.date),
        volumes: m.volumes ?? { tc: 0, wt: 0, et: 0 },
        metrics: m.metrics ?? null,
        source: m.source ?? "upload",
        overlayUrl: e.attachments[0]?.url ?? null,
        analysisFile: m.analysisFile ?? null,
      }
    })

  return (
    <div className="flex flex-col lg:h-full">
      {/* Header */}
      <div className="flex min-h-16 flex-wrap items-center justify-between gap-x-2 gap-y-2 border-b bg-card px-4 sm:px-6 py-2 sm:py-0 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link href="/patients">
            <Button variant="ghost" size="sm" className="gap-2 -ml-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              {t("action.back")}
            </Button>
          </Link>
          <div className="h-4 w-px bg-border shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-none truncate">{patient.firstName} {patient.lastName}</p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{t("patient.detail.breadcrumb")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <PatientStatusSelect patientId={id} currentStatus={patient.status} />
          <Link href={`/patients/${id}/edit`}>
            <Button variant="outline" size="sm" className="gap-2" title={t("action.edit")}>
              <Pencil className="h-4 w-4" />
              <span className="hidden sm:inline">{t("action.edit")}</span>
            </Button>
          </Link>
          <PatientActions patientId={id} />
        </div>
      </div>

      <div className="p-4 sm:p-6 flex flex-col gap-6 flex-1 lg:min-h-0">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:flex-1 lg:min-h-0">
          {/* Patient Info Card */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="overflow-hidden">
              {/* Profile header strip */}
              <div className="bg-muted/40 px-5 pt-5 pb-4 border-b">
                <div className="flex items-start gap-3">
                  <Avatar className="h-12 w-12 shrink-0 mt-0.5">
                    <AvatarFallback className="text-base font-bold bg-primary/10 text-primary">
                      {patient.firstName[0]}{patient.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-semibold leading-snug">{patient.firstName} {patient.lastName}</h2>
                    {patient.assignedDoctor && (
                      <p className="text-xs text-muted-foreground mt-0.5">{patient.assignedDoctor.name}</p>
                    )}
                    <div className="mt-2 space-y-1">
                      <div className="group flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3 shrink-0" />
                        <span>{patient.phone}</span>
                        <CopyButton value={patient.phone} />
                      </div>
                      {patient.email && (
                        <div className="group flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3 shrink-0" />
                          <span className="truncate">{patient.email}</span>
                          <CopyButton value={patient.email} />
                        </div>
                      )}
                      {patient.address && (
                        <div className="group flex items-start gap-1.5 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
                          <span className="leading-snug">{patient.address}</span>
                          <CopyButton value={patient.address} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {(patient.emergencyContactName || patient.emergencyContactPhone) && (
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
                      {t("patient.detail.emergency_contact")}
                    </p>
                    <div className="space-y-1">
                      {patient.emergencyContactName && (
                        <p className="text-xs font-medium">
                          {patient.emergencyContactName}
                          {patient.emergencyContactRelation && (
                            <span className="text-muted-foreground font-normal"> · {patient.emergencyContactRelation}</span>
                          )}
                        </p>
                      )}
                      {patient.emergencyContactPhone && (
                        <div className="group flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3 shrink-0" />
                          <span>{patient.emergencyContactPhone}</span>
                          <CopyButton value={patient.emergencyContactPhone} />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60 mt-3">
                  <Clock className="h-3 w-3 shrink-0" />
                  <span>{t("patient.detail.registered_at")} {format(patient.createdAt, "d MMM yyyy", { locale: tr })}</span>
                </div>
              </div>

              <CardContent className="p-0">
                {/* Demographics grid */}
                <div className="px-5 py-4">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                    {t("patient.detail.clinical_info")}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-md bg-muted/40 px-3 py-2.5">
                      <p className="text-[10px] text-muted-foreground mb-0.5">{t("patient.detail.age")}</p>
                      <p className="text-sm font-semibold">{age}</p>
                    </div>
                    <div className="rounded-md bg-muted/40 px-3 py-2.5">
                      <p className="text-[10px] text-muted-foreground mb-0.5">{t("field.patient.gender")}</p>
                      <p className="text-sm font-semibold">{genderLabel}</p>
                    </div>
                    {bloodLabel && (
                      <div className="rounded-md bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900/60 px-3 py-2.5">
                        <p className="text-[10px] text-red-500 dark:text-red-400 mb-0.5">{t("field.patient.blood_type")}</p>
                        <p className="text-sm font-bold text-red-700 dark:text-red-400">{bloodLabel}</p>
                      </div>
                    )}
                    {patient.tcNo && (
                      <div className="rounded-md bg-muted/40 px-3 py-2.5">
                        <p className="text-[10px] text-muted-foreground mb-0.5">{t("field.patient.tc_no")}</p>
                        <p className="text-xs font-mono font-medium leading-snug">{patient.tcNo}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Allergy warning strip */}
                {patient.allergies.length > 0 && (
                  <>
                    <Separator />
                    <div className="bg-amber-50 dark:bg-amber-950/40 border-l-4 border-l-amber-400 dark:border-l-amber-600">
                      <div className="px-5 py-4">
                        <div className="flex items-center gap-1.5 mb-2.5">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400">
                            {t("patient.detail.allergies")}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {patient.allergies.map((a) => (
                            <span
                              key={a}
                              className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/50 border border-amber-300 dark:border-amber-700 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-300"
                            >
                              {a}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Chronic conditions */}
                {patient.chronicConditions.length > 0 && (
                  <>
                    <Separator />
                    <div className="px-5 py-4">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2.5">
                        {t("field.patient.chronic_conditions")}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {patient.chronicConditions.map((c) => (
                          <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Active Diagnoses */}
            <Card>
              <CardHeader className="pb-2 px-5 pt-4">
                <CardTitle className="text-sm font-semibold">{t("patient.detail.active_diagnoses")}</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4 space-y-2">
                {patient.diagnoses.map((d) => (
                  <div
                    key={d.id}
                    className={`rounded-md border-l-[3px] bg-muted/30 px-3 py-2.5 ${
                      d.severity === "severe"
                        ? "border-l-red-500"
                        : d.severity === "moderate"
                          ? "border-l-amber-500"
                          : "border-l-green-500"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-snug">{d.name}</p>
                      <Badge variant={diagnosisSeverity[d.severity].variant} className="text-xs shrink-0">
                        {diagnosisSeverity[d.severity].label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {d.icdCode && (
                        <span className="text-[10px] font-mono text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
                          {d.icdCode}
                        </span>
                      )}
                      <Badge variant={diagnosisStatus[d.status].variant} className="text-[10px] h-4 px-1.5 py-0">
                        {diagnosisStatus[d.status].label}
                      </Badge>
                    </div>
                  </div>
                ))}
                {patient.diagnoses.length === 0 && (
                  <p className="text-sm text-muted-foreground py-2">{t("patient.detail.no_diagnoses")}</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Main Content - Tabs */}
          <div className="lg:col-span-2 flex flex-col lg:min-h-0">
            <div className="shrink-0 mb-4 space-y-3">
              <ClinicalSummaryPanel
                patientId={id}
                canGenerate={can(session.permissions, "patient:update")}
                summary={patient.aiSummary}
                summaryData={patient.aiSummaryData as AiSummaryData | null}
                generatedAt={patient.aiSummaryAt ? patient.aiSummaryAt.toISOString() : null}
              />
            </div>
            <Tabs defaultValue="timeline" className="flex flex-col lg:flex-1 lg:min-h-0">
              <TabsList className="w-full shrink-0">
                <TabsTrigger value="timeline" className="flex-1 min-w-0 truncate px-2 sm:px-3 text-xs sm:text-sm">{t("patient.detail.tab.timeline")}</TabsTrigger>
                <TabsTrigger value="prescriptions" className="flex-1 min-w-0 truncate px-2 sm:px-3 text-xs sm:text-sm">{t("patient.detail.tab.prescriptions")}</TabsTrigger>
                <TabsTrigger value="documents" className="flex-1 min-w-0 truncate px-2 sm:px-3 text-xs sm:text-sm">{t("patient.detail.tab.documents")}</TabsTrigger>
                <TabsTrigger value="brainmri" className="flex-1 min-w-0 truncate px-2 sm:px-3 text-xs sm:text-sm">{t("patient.detail.tab.brainmri")}</TabsTrigger>
              </TabsList>

              {/* Timeline */}
              <TabsContent value="timeline" className="flex flex-col lg:flex-1 lg:min-h-0 mt-2">
                <Card className="flex flex-col lg:flex-1 lg:min-h-0">
                  <CardContent className="p-4 flex flex-col lg:flex-1 lg:min-h-0">
                    <ScrollArea className="lg:flex-1 lg:min-h-0 pr-1 sm:pr-4 max-lg:max-h-[70vh]">
                      <div className="relative">
                        <div className="absolute left-4 sm:left-5 top-0 bottom-0 w-px bg-border" />
                        <div className="space-y-4">
                          {patient.timelineEvents.map((event) => {
                            const type = event.type as TimelineEventType
                            const Icon = EVENT_ICONS[type]
                            const style = EVENT_STYLES[type]
                            const label = eventLabels[type]
                            const meta = event.metadata as Record<string, string> | null
                            return (
                              <div key={event.id} className="relative flex gap-2.5 sm:gap-4 group">
                                <div className={`relative z-10 flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full border-2 bg-background ${style.bgColor}`}>
                                  <Icon className={`h-4 w-4 ${style.color}`} />
                                </div>
                                <div className={`flex-1 min-w-0 rounded-lg border p-2.5 sm:p-3 ${style.bgColor} mb-2`}>
                                  <div className="flex items-start justify-between gap-2 flex-wrap">
                                    <div>
                                      <p className="font-semibold text-sm">{event.title}</p>
                                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                                        <Clock className="h-3 w-3" />
                                        {format(event.date, "d MMMM yyyy, HH:mm", { locale: tr })}
                                        <span>·</span>
                                        <span>{event.createdBy.name}</span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <Badge variant="outline" className={`text-xs ${style.color}`}>
                                        {label}
                                      </Badge>
                                      {canDeleteTimeline && (
                                        <TimelineDeleteButton eventId={event.id} patientId={id} />
                                      )}
                                    </div>
                                  </div>
                                  {event.type !== "document" && (
                                    <p className="mt-2 text-sm text-foreground/80 leading-relaxed">
                                      {event.description}
                                    </p>
                                  )}
                                  {meta && event.type !== "document" && (() => {
                                    const entries = Object.entries(meta as Record<string, unknown>).filter(
                                      ([, v]) => typeof v === "string" || typeof v === "number"
                                    )
                                    return entries.length > 0 ? (
                                      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {entries.map(([key, value]) => (
                                          <div key={key} className="rounded-md bg-background/60 px-2 py-1">
                                            <p className="text-xs text-muted-foreground">{key}</p>
                                            <p className="text-sm font-semibold">{String(value)}</p>
                                          </div>
                                        ))}
                                      </div>
                                    ) : null
                                  })()}
                                  {event.attachments.length > 0 && (() => {
                                    const bm = event.metadata as {
                                      analysisType?: string
                                      analysisFile?: string
                                      volumes?: { tc: number; wt: number; et: number }
                                      metrics?: BrainAnalysisSummary["metrics"]
                                    } | null
                                    // Beyin MR analiz kaydı → interaktif görüntüleyici modalı.
                                    if (bm?.analysisType === "brain_tumor_segmentation") {
                                      return (
                                        <div className="mt-3 flex flex-wrap gap-2">
                                          <TimelineBrainViewerButton
                                            patientId={id}
                                            title={event.title}
                                            overlayUrl={event.attachments[0]?.url ?? null}
                                            analysisFile={bm.analysisFile ?? null}
                                            volumes={bm.volumes ?? { tc: 0, wt: 0, et: 0 }}
                                            metrics={bm.metrics ?? null}
                                          />
                                        </div>
                                      )
                                    }
                                    return (
                                      <div className="mt-3 flex flex-wrap gap-2">
                                        {event.attachments.map((att) => (
                                          <TimelineDocumentButton
                                            key={att.id}
                                            fileName={att.name}
                                            fileUrl={att.url}
                                            title={event.title}
                                            meta={event.type === "document" ? (event.metadata as { aiReport?: string | null; extractedValues?: { name: string; value: string; unit: string; refRange: string; status: "normal" | "high" | "low" | "critical" }[] | null } | null) : null}
                                          />
                                        ))}
                                      </div>
                                    )
                                  })()}
                                </div>
                              </div>
                            )
                          })}
                          {patient.timelineEvents.length === 0 && (
                            <p className="text-center text-sm text-muted-foreground py-8">
                              {t("patient.detail.no_timeline")}
                            </p>
                          )}
                        </div>
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Prescriptions */}
              <TabsContent value="prescriptions" className="lg:flex-1 mt-2">
                <Card>
                  <div className="flex items-center justify-between px-4 pt-4 pb-2">
                    <p className="text-sm font-semibold">
                      {patient.prescriptions.length > 0
                        ? `${patient.prescriptions.length} ${t("patient.detail.tab.prescriptions").toLowerCase()}`
                        : t("patient.detail.tab.prescriptions")}
                    </p>
                    <AddPrescriptionDialog patientId={id} />
                  </div>
                  <CardContent className="px-4 pb-4 space-y-3">
                    {patient.prescriptions.map((rx) => (
                      <div key={rx.id} className="flex items-start gap-3 rounded-lg border p-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-50 dark:bg-teal-950/40">
                          <Pill className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-sm">{rx.medication}</p>
                            <Badge variant={rx.active ? "success" : "secondary"} className="text-xs">
                              {rx.active ? t("patient.detail.prescription.active") : t("patient.detail.prescription.inactive")}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {rx.dosage} · {rx.frequency} · {rx.duration}
                          </p>
                          {rx.instructions && (
                            <p className="text-xs text-muted-foreground mt-0.5 italic">
                              {rx.instructions}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {rx.prescribedBy.name} · {format(rx.prescribedAt, "d MMM yyyy", { locale: tr })}
                          </p>
                        </div>
                      </div>
                    ))}
                    {patient.prescriptions.length === 0 && (
                      <p className="text-center text-sm text-muted-foreground py-6">
                        {t("patient.detail.no_prescriptions")}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Documents */}
              <TabsContent value="documents" className="lg:flex-1 mt-2">
                <Card>
                  <CardContent className="p-4">
                    <DocumentsSection
                      patientId={id}
                      initialDocuments={patient.timelineEvents
                        .filter((e) => e.type === "document")
                        .map((e) => ({
                          id: e.id,
                          title: e.title,
                          description: e.description,
                          date: e.date,
                          metadata: e.metadata as DocumentEvent["metadata"],
                          createdBy: e.createdBy,
                          attachments: e.attachments,
                        }))}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Beyin MR Tümör Analizi — forceMount + gizleme: sekme değişse de
                  canlı görüntüleyici state'i korunsun (Radix aksi halde unmount eder). */}
              <TabsContent
                value="brainmri"
                forceMount
                className="lg:flex-1 mt-2 data-[state=inactive]:hidden"
              >
                <BrainTumorPanel
                  patientId={id}
                  canRun={can(session.permissions, "document:upload")}
                  initialAnalyses={brainAnalyses}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  )
}
