"use client"

import { useActionState, useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { createPatientAction, type PatientFormState } from "@/lib/actions/patients"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader,
  DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import {
  X, Loader2, ArrowLeft, User, Phone, Stethoscope, AlertTriangle, Wand2, Users,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { getRecommendedDoctorAction } from "@/lib/actions/patients"
import { IcdSearchInput, formatIcdEntry, extractIcdCode } from "@/components/icd-search-input"
import { useT } from "@/store/translations-context"

type Doctor = {
  id: string
  name: string
  roleLabel: string
  patientCount: number
  departmentIds: string[]
}
type Department = { id: string; name: string; color: string }

const BACK_PATH = "/patients"

const inputClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"

const labelClass = "text-sm font-medium text-foreground"

const bloodTypeOptions = [
  { value: "A_pos", label: "A+" }, { value: "A_neg", label: "A-" },
  { value: "B_pos", label: "B+" }, { value: "B_neg", label: "B-" },
  { value: "AB_pos", label: "AB+" }, { value: "AB_neg", label: "AB-" },
  { value: "O_pos", label: "O+" }, { value: "O_neg", label: "O-" },
]

function FieldError({ errors, field }: { errors?: Record<string, string[]>; field: string }) {
  const msgs = errors?.[field]
  if (!msgs?.length) return null
  return <p className="text-xs text-destructive mt-1">{msgs[0]}</p>
}

function TagInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
}) {
  const [input, setInput] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const addTag = () => {
    const tag = input.trim().replace(/,$/, "")
    if (tag && !value.includes(tag)) onChange([...value, tag])
    setInput("")
  }

  return (
    <div
      className="min-h-9 flex flex-wrap gap-1.5 items-center rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-sm focus-within:ring-1 focus-within:ring-ring cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      {value.map((tag) => (
        <Badge key={tag} variant="secondary" className="flex items-center gap-1 pr-1 font-normal">
          {tag}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(value.filter((t) => t !== tag)) }}
            className="hover:text-destructive transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <input
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag() }
          if (e.key === "Backspace" && !input && value.length > 0) onChange(value.slice(0, -1))
        }}
        onBlur={addTag}
        placeholder={value.length === 0 ? placeholder : ""}
        className="flex-1 min-w-24 bg-transparent outline-none placeholder:text-muted-foreground text-sm"
      />
    </div>
  )
}

export function NewPatientForm({
  doctors,
  departments,
}: {
  doctors: Doctor[]
  departments: Department[]
}) {
  const t = useT()
  const router = useRouter()
  const [state, action, pending] = useActionState<PatientFormState, FormData>(createPatientAction, {})
  const [allergies, setAllergies] = useState<string[]>([])
  const [chronicConditions, setChronicConditions] = useState<string[]>([])
  const [isDirty, setIsDirty] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("")
  const [selectedDoctorId, setSelectedDoctorId] = useState("")
  const [autoAssigning, setAutoAssigning] = useState(false)

  const filteredDoctors = selectedDepartmentId
    ? doctors.filter((d) => d.departmentIds.includes(selectedDepartmentId))
    : doctors

  const selectedDoctor = doctors.find((d) => d.id === selectedDoctorId) ?? null

  async function handleAutoAssign() {
    if (!selectedDepartmentId) return
    setAutoAssigning(true)
    try {
      const result = await getRecommendedDoctorAction(selectedDepartmentId)
      if (result.doctorId) setSelectedDoctorId(result.doctorId)
    } finally {
      setAutoAssigning(false)
    }
  }

  useEffect(() => {
    if (state.success && state.patientId) {
      setIsDirty(false)
      router.push(`/patients/${state.patientId}`)
    }
  }, [state.success, state.patientId, router])

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (isDirty) e.preventDefault() }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [isDirty])

  function handleBack() {
    if (isDirty) { setShowConfirm(true) } else { router.push(BACK_PATH) }
  }

  function handleTagChange(setter: (v: string[]) => void) {
    return (tags: string[]) => { setter(tags); setIsDirty(true) }
  }

  function handleIcdSelect(setter: (v: string[]) => void, current: string[]) {
    return (entry: { code: string; title: string }) => {
      const formatted = formatIcdEntry(entry)
      if (!current.includes(formatted)) { setter([...current, formatted]); setIsDirty(true) }
    }
  }

  return (
    <div className="max-w-4xl">
      {/* Confirmation dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("patient.form.unsaved_title")}</DialogTitle>
            <DialogDescription>{t("patient.form.unsaved_desc")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>
              {t("action.dismiss")}
            </Button>
            <Button variant="destructive" onClick={() => router.push(BACK_PATH)}>
              {t("action.discard")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Top navigation */}
      <div className="mb-6 flex items-center">
        <Button type="button" variant="ghost" size="sm" onClick={handleBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          {t("patient.form.back_to_patients")}
        </Button>
      </div>

      <form
        action={action}
        onChange={() => setIsDirty(true)}
        className="space-y-6"
      >
        <input type="hidden" name="allergies" value={JSON.stringify(allergies)} />
        <input type="hidden" name="chronicConditions" value={JSON.stringify(chronicConditions)} />

        {state.message && !state.success && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
            {state.message}
          </div>
        )}

        {/* Kişisel Bilgiler */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              {t("patient.form.personal_info")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="firstName" className={labelClass}>
                  {t("field.patient.first_name")} <span className="text-destructive">*</span>
                </label>
                <Input id="firstName" name="firstName" autoComplete="given-name" />
                <FieldError errors={state.errors} field="firstName" />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="lastName" className={labelClass}>
                  {t("field.patient.last_name")} <span className="text-destructive">*</span>
                </label>
                <Input id="lastName" name="lastName" autoComplete="family-name" />
                <FieldError errors={state.errors} field="lastName" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="tcNo" className={labelClass}>{t("field.patient.tc_no")}</label>
                <Input id="tcNo" name="tcNo" maxLength={11} inputMode="numeric" />
                <FieldError errors={state.errors} field="tcNo" />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="dateOfBirth" className={labelClass}>
                  {t("field.patient.dob")} <span className="text-destructive">*</span>
                </label>
                <Input id="dateOfBirth" name="dateOfBirth" type="date" />
                <FieldError errors={state.errors} field="dateOfBirth" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="gender" className={labelClass}>
                {t("field.patient.gender")} <span className="text-destructive">*</span>
              </label>
              <select id="gender" name="gender" className={cn(inputClass, "bg-background")}>
                <option value="">{t("patient.form.select_placeholder")}</option>
                <option value="male">{t("gender.male")}</option>
                <option value="female">{t("gender.female")}</option>
                <option value="other">{t("gender.other")}</option>
              </select>
              <FieldError errors={state.errors} field="gender" />
            </div>
          </CardContent>
        </Card>

        {/* İletişim */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              {t("patient.form.contact_info")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="phone" className={labelClass}>
                  {t("field.patient.phone")} <span className="text-destructive">*</span>
                </label>
                <Input id="phone" name="phone" type="tel" autoComplete="tel" />
                <FieldError errors={state.errors} field="phone" />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="email" className={labelClass}>{t("field.patient.email")}</label>
                <Input id="email" name="email" type="email" autoComplete="email" />
                <FieldError errors={state.errors} field="email" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="address" className={labelClass}>{t("field.patient.address")}</label>
              <textarea
                id="address"
                name="address"
                rows={2}
                className={cn(inputClass, "min-h-16 py-2 resize-none bg-background")}
              />
            </div>
          </CardContent>
        </Card>

        {/* Tıbbi Bilgiler */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-muted-foreground" />
              {t("patient.form.medical_info")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="bloodType" className={labelClass}>{t("field.patient.blood_type")}</label>
                <select id="bloodType" name="bloodType" className={cn(inputClass, "bg-background")}>
                  <option value="">{t("common.unknown")}</option>
                  {bloodTypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="status" className={labelClass}>{t("field.patient.status")}</label>
                <select id="status" name="status" defaultValue="active" className={cn(inputClass, "bg-background")}>
                  <option value="active">{t("status.patient.active")}</option>
                  <option value="inactive">{t("status.patient.inactive")}</option>
                  <option value="critical">{t("status.patient.critical")}</option>
                  <option value="discharged">{t("status.patient.discharged")}</option>
                </select>
              </div>
            </div>
            {/* Departman seçici */}
            <div className="space-y-1.5">
              <label htmlFor="departmentFilter" className={labelClass}>{t("nav.departments")}</label>
              <select
                id="departmentFilter"
                value={selectedDepartmentId}
                onChange={(e) => {
                  setSelectedDepartmentId(e.target.value)
                  setSelectedDoctorId("")
                  setIsDirty(true)
                }}
                className={cn(inputClass, "bg-background")}
              >
                <option value="">{t("patient.form.all_departments")}</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* Doktor seçici */}
            <div className="space-y-1.5">
              <label className={labelClass}>{t("field.patient.assigned_doctor")}</label>
              <input type="hidden" name="assignedDoctorId" value={selectedDoctorId} />
              <div className="flex gap-2">
                <select
                  value={selectedDoctorId}
                  onChange={(e) => { setSelectedDoctorId(e.target.value); setIsDirty(true) }}
                  className={cn(inputClass, "bg-background flex-1")}
                >
                  <option value="">{t("patient.form.no_doctor")}</option>
                  {filteredDoctors.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.name} — {doc.patientCount} {t("patient.form.active_patients")}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!selectedDepartmentId || autoAssigning || filteredDoctors.length === 0}
                  onClick={handleAutoAssign}
                  className="shrink-0 gap-1.5"
                >
                  {autoAssigning
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Wand2 className="h-3.5 w-3.5" />}
                  {t("patient.form.auto_assign")}
                </Button>
              </div>
              {selectedDoctor && (
                <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    <span className="font-medium text-foreground">{selectedDoctor.name}</span>
                    {" "}· {selectedDoctor.roleLabel} · {selectedDoctor.patientCount} {t("patient.form.active_patients")}
                  </span>
                </div>
              )}
              {selectedDepartmentId && filteredDoctors.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  {t("patient.form.no_doctors_in_dept")}
                </p>
              )}
            </div>
            <Separator />
            <div className="space-y-1.5">
              <label className={labelClass}>
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  {t("field.patient.allergies")}
                </span>
              </label>
              <IcdSearchInput
                onSelect={handleIcdSelect(setAllergies, allergies)}
                existingCodes={allergies.map(extractIcdCode).filter((c): c is string => c !== null)}
              />
              <TagInput
                value={allergies}
                onChange={handleTagChange(setAllergies)}
                placeholder={t("patient.form.allergies.placeholder")}
              />
              <p className="text-xs text-muted-foreground">{t("patient.form.allergies.hint")}</p>
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>{t("field.patient.chronic_conditions")}</label>
              <IcdSearchInput
                onSelect={handleIcdSelect(setChronicConditions, chronicConditions)}
                existingCodes={chronicConditions.map(extractIcdCode).filter((c): c is string => c !== null)}
              />
              <TagInput
                value={chronicConditions}
                onChange={handleTagChange(setChronicConditions)}
                placeholder={t("patient.form.chronic.placeholder")}
              />
              <p className="text-xs text-muted-foreground">{t("patient.form.chronic.hint")}</p>
            </div>
          </CardContent>
        </Card>

        {/* Acil İletişim */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              {t("patient.form.emergency_contact_section")}
              <span className="text-xs font-normal text-muted-foreground ml-1">{t("patient.form.optional")}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="emergencyContactName" className={labelClass}>{t("common.name")}</label>
                <Input id="emergencyContactName" name="emergencyContactName" />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="emergencyContactRelation" className={labelClass}>{t("field.patient.emergency_contact")}</label>
                <select id="emergencyContactRelation" name="emergencyContactRelation" className={cn(inputClass, "bg-background")}>
                  <option value="">{t("patient.form.select_placeholder")}</option>
                  <option value="Eş">{t("patient.form.relation.spouse")}</option>
                  <option value="Anne">{t("patient.form.relation.mother")}</option>
                  <option value="Baba">{t("patient.form.relation.father")}</option>
                  <option value="Kardeş">{t("patient.form.relation.sibling")}</option>
                  <option value="Çocuk">{t("patient.form.relation.child")}</option>
                  <option value="Akraba">{t("patient.form.relation.relative")}</option>
                  <option value="Diğer">{t("gender.other")}</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="emergencyContactPhone" className={labelClass}>{t("field.patient.phone")}</label>
              <Input id="emergencyContactPhone" name="emergencyContactPhone" type="tel" />
            </div>
          </CardContent>
        </Card>

        {/* Bottom actions */}
        <div className="flex items-center justify-between pt-2">
          <Button type="button" variant="ghost" onClick={handleBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            {t("action.back")}
          </Button>
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={handleBack}>
              {t("action.cancel")}
            </Button>
            <Button type="submit" disabled={pending} className="gap-2 min-w-32">
              {pending ? (
                <><Loader2 className="h-4 w-4 animate-spin" />{t("action.saving")}</>
              ) : (
                t("patient.form.submit")
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
