import { create } from "zustand"
import type { PatientStatus } from "@/generated/prisma/enums"
import type { PatientSort } from "@/lib/db/patients"

type StatusFilter = PatientStatus | "all"

interface PatientFilterState {
  search: string
  statusFilter: StatusFilter
  sort: PatientSort
  setSearch: (search: string) => void
  setStatusFilter: (status: StatusFilter) => void
  setSort: (sort: PatientSort) => void
  reset: () => void
}

export const usePatientFilterStore = create<PatientFilterState>()((set) => ({
  search: "",
  statusFilter: "all",
  sort: "updated_desc",
  setSearch: (search) => set({ search }),
  setStatusFilter: (statusFilter) => set({ statusFilter }),
  setSort: (sort) => set({ sort }),
  reset: () => set({ search: "", statusFilter: "all", sort: "updated_desc" }),
}))
