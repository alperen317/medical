"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import { useT } from "@/store/translations-context"

export function MyPatientsFilters() {
  const t = useT()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(searchParams.get("search") ?? "")
  const status = searchParams.get("status") ?? ""

  const STATUS_OPTS = [
    { value: "",           label: t("common.all") },
    { value: "active",     label: t("status.patient.active") },
    { value: "critical",   label: t("status.patient.critical") },
    { value: "inactive",   label: t("status.patient.inactive") },
    { value: "discharged", label: t("status.patient.discharged") },
  ]

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      if (status) params.set("status", status)
      router.push(`${pathname}?${params.toString()}`)
    }, 300)
    return () => clearTimeout(timer)
  }, [search, status, pathname, router])

  function setStatus(val: string) {
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    if (val) params.set("status", val)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("my_patients.search_placeholder")}
          className="w-72 pl-8"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex gap-2 flex-wrap">
        {STATUS_OPTS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatus(opt.value)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              status === opt.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
