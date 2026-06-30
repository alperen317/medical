"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Search, Plus, Phone, Calendar,
  User, ChevronRight, AlertTriangle, Loader2, ArrowUpDown,
} from "lucide-react"
import { format, differenceInYears } from "date-fns"
import { tr } from "date-fns/locale"
import { usePatientFilterStore } from "@/store/patient-filter.store"
import type { PatientStatus } from "@/generated/prisma/enums"
import type { PatientSort } from "@/lib/db/patients"
import { cn } from "@/lib/utils"
import { useT } from "@/store/translations-context"

type PatientRow = {
  id: string
  firstName: string
  lastName: string
  dateOfBirth: Date | string
  gender: string
  bloodType: string | null
  phone: string
  status: PatientStatus
  allergies: string[]
  chronicConditions: string[]
  createdAt: Date | string
  assignedDoctor: { name: string } | null
  _count: { timelineEvents: number; diagnoses: number }
}

const bloodTypeLabels: Record<string, string> = {
  A_pos: "A+", A_neg: "A-", B_pos: "B+", B_neg: "B-",
  AB_pos: "AB+", AB_neg: "AB-", O_pos: "O+", O_neg: "O-",
}

const STATUS_VARIANTS: Record<PatientStatus, "success" | "secondary" | "destructive" | "outline"> = {
  active:     "success",
  inactive:   "secondary",
  critical:   "destructive",
  discharged: "outline",
}

export default function PatientsPage() {
  const t = useT()
  const { search, statusFilter, sort, setSearch, setStatusFilter, setSort } = usePatientFilterStore()
  const [patients, setPatients] = useState<PatientRow[]>([])
  const [total, setTotal] = useState(0)
  const [isPending, startTransition] = useTransition()
  const [sortOpen, setSortOpen] = useState(false)

  const statusConfig = {
    active:     { label: t("status.patient.active"),     variant: STATUS_VARIANTS.active },
    inactive:   { label: t("status.patient.inactive"),   variant: STATUS_VARIANTS.inactive },
    critical:   { label: t("status.patient.critical"),   variant: STATUS_VARIANTS.critical },
    discharged: { label: t("status.patient.discharged"), variant: STATUS_VARIANTS.discharged },
  }

  const filterOptions: { value: PatientStatus | "all"; label: string }[] = [
    { value: "all",       label: t("common.all") },
    { value: "active",    label: t("status.patient.active") },
    { value: "critical",  label: t("status.patient.critical") },
    { value: "inactive",  label: t("status.patient.inactive") },
    { value: "discharged",label: t("status.patient.discharged") },
  ]

  const sortOptions: { value: PatientSort; label: string }[] = [
    { value: "updated_desc", label: t("patient.sort.updated_desc") },
    { value: "date_desc",    label: t("patient.sort.date_desc") },
    { value: "date_asc",     label: t("patient.sort.date_asc") },
    { value: "name_asc",     label: t("patient.sort.name_asc") },
    { value: "name_desc",    label: t("patient.sort.name_desc") },
    { value: "status",       label: t("patient.sort.by_status") },
  ]

  const genderLabel = (g: string) =>
    g === "male" ? t("gender.male") : g === "female" ? t("gender.female") : t("gender.other")

  useEffect(() => {
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    if (statusFilter !== "all") params.set("status", statusFilter)
    if (sort !== "updated_desc") params.set("sort", sort)

    startTransition(async () => {
      try {
        const res = await fetch(`/api/patients?${params}`)
        if (res.ok) {
          const data = await res.json()
          setPatients(data.patients)
          setTotal(data.total)
        }
      } catch {
        // bağlantı hatası — mevcut listeyi koru
      }
    })
  }, [search, statusFilter, sort])

  const currentSortLabel = sortOptions.find((o) => o.value === sort)?.label ?? t("action.filter")

  return (
    <div>
      <Header
        title={t("page.patients.title")}
        subtitle={total > 0 ? `${total} ${t("patient.registered_count_suffix")}` : t("common.loading")}
      />

      <div className="p-6 space-y-5">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("patient.search_placeholder")}
                className="w-72 pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Sort dropdown */}
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setSortOpen((v) => !v)}
              >
                <ArrowUpDown className="h-4 w-4" />
                <span className="hidden sm:inline">{currentSortLabel}</span>
              </Button>
              {sortOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setSortOpen(false)}
                  />
                  <div className="absolute left-0 top-full z-20 mt-1 min-w-44 rounded-md border bg-popover shadow-md py-1">
                    {sortOptions.map((opt) => (
                      <button
                        key={opt.value}
                        className={cn(
                          "flex w-full items-center px-3 py-2 text-sm transition-colors hover:bg-muted",
                          sort === opt.value && "font-medium text-primary"
                        )}
                        onClick={() => { setSort(opt.value); setSortOpen(false) }}
                      >
                        {opt.label}
                        {sort === opt.value && <span className="ml-auto text-xs">✓</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <Link href="/patients/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              {t("patient.new.button")}
            </Button>
          </Link>
        </div>

        {/* Status Filter */}
        <div className="flex gap-2 flex-wrap">
          {filterOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                statusFilter === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Patient List */}
        {isPending ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : patients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <User className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">
              {search || statusFilter !== "all"
                ? t("patient.empty.no_match")
                : t("patient.empty.none")}
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {patients.map((patient) => {
              const status = statusConfig[patient.status]
              const age = differenceInYears(new Date(), new Date(patient.dateOfBirth))
              const bloodLabel = patient.bloodType ? bloodTypeLabels[patient.bloodType] : null
              return (
                <Link key={patient.id} href={`/patients/${patient.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer group">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12 shrink-0">
                          <AvatarFallback className="text-sm font-semibold bg-primary/10 text-primary">
                            {patient.firstName[0]}{patient.lastName[0]}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold">
                              {patient.firstName} {patient.lastName}
                            </h3>
                            <Badge variant={status.variant}>{status.label}</Badge>
                            {patient.status === "critical" && (
                              <AlertTriangle className="h-4 w-4 text-destructive" />
                            )}
                          </div>

                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {age} {t("patient.age_suffix")} · {genderLabel(patient.gender)}
                              {bloodLabel && ` · ${bloodLabel}`}
                            </span>
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {patient.phone}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(patient.createdAt), "d MMM yyyy", { locale: tr })}
                            </span>
                          </div>

                          {patient.chronicConditions.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {patient.chronicConditions.map((c) => (
                                <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="hidden sm:flex flex-col items-end gap-1 shrink-0 text-xs text-muted-foreground">
                          {patient.assignedDoctor && <span>{patient.assignedDoctor.name}</span>}
                          {patient.allergies.length > 0 && (
                            <Badge variant="warning" className="text-xs">
                              {t("patient.allergy_prefix")} {patient.allergies.length}
                            </Badge>
                          )}
                        </div>

                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
