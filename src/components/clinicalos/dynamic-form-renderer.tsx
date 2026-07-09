"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NODE_VISUALS } from "@/lib/workflow/node-visuals"
import { cn } from "@/lib/utils"
import type { FormField } from "@/lib/workflow/types"

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"

type Props = {
  title: string
  fields: FormField[]
  pending: boolean
  onSubmit: (values: Record<string, unknown>) => void
  initialValues?: Record<string, unknown>
}

export function DynamicFormRenderer({ title, fields, pending, onSubmit, initialValues }: Props) {
  const [values, setValues] = useState<Record<string, unknown>>(() => initialValues ?? {})

  const setValue = (id: string, value: unknown) => setValues((prev) => ({ ...prev, [id]: value }))

  // Boolean (evet/hayır) alanlar her zaman bir değere sahip olduğundan zorunlu
  // sayımına "dolu" kabul edilir — DocumentStep'teki zorunlu belge sayacıyla
  // aynı mantık: ilerlemeyi engelleyen koşulla gösterge birebir tutarlı olsun.
  const requiredFields = fields.filter((f) => f.required)
  const filledRequiredCount = requiredFields.filter((f) => f.type === "boolean" || !!values[f.id]).length
  const missingRequired = filledRequiredCount < requiredFields.length

  // Kısa alanlar (metin/sayı/tarih/seçim) 2 kolonlu grid'de yan yana durur;
  // uzun metin, evet/hayır ve dosya notu her zaman tam genişlik kaplar.
  const isWide = (type: FormField["type"]) => type === "textarea" || type === "boolean" || type === "file"

  const Icon = NODE_VISUALS.form.icon

  return (
    <div className="space-y-4">
      {title && (
        <div className="flex items-center gap-3">
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", NODE_VISUALS.form.bg, NODE_VISUALS.form.color)}>
            <Icon className="h-5 w-5" />
          </div>
          <h2 className="text-base font-semibold leading-tight">{title}</h2>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {fields.map((field) => (
          <div key={field.id} className={`space-y-1.5 ${isWide(field.type) ? "sm:col-span-2" : ""}`}>
            <label className="text-sm font-medium">
              {field.label}
              {field.required && <span className="text-destructive"> *</span>}
            </label>

            {field.type === "text" && (
              <Input value={(values[field.id] as string) ?? ""} onChange={(e) => setValue(field.id, e.target.value)} />
            )}
            {field.type === "number" && (
              <Input type="number" value={(values[field.id] as string) ?? ""} onChange={(e) => setValue(field.id, e.target.value === "" ? "" : Number(e.target.value))} />
            )}
            {field.type === "date" && (
              <Input type="date" value={(values[field.id] as string) ?? ""} onChange={(e) => setValue(field.id, e.target.value)} />
            )}
            {field.type === "textarea" && (
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={(values[field.id] as string) ?? ""}
                onChange={(e) => setValue(field.id, e.target.value)}
              />
            )}
            {field.type === "boolean" && (
              <label className="flex w-fit items-center gap-2 rounded-md border border-input px-3 h-9 text-sm cursor-pointer hover:bg-muted/40 transition-colors">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={Boolean(values[field.id])}
                  onChange={(e) => setValue(field.id, e.target.checked)}
                />
                Evet
              </label>
            )}
            {field.type === "select" && (
              <select className={selectClass} value={(values[field.id] as string) ?? ""} onChange={(e) => setValue(field.id, e.target.value)}>
                <option value="">— Seçiniz —</option>
                {(field.options ?? []).map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            )}
            {field.type === "file" && (
              <p className="text-xs text-muted-foreground italic">
                Bu alan için belge, workflow&apos;daki bir sonraki Belge adımında yüklenir.
              </p>
            )}
          </div>
        ))}
        {fields.length === 0 && (
          <p className="text-sm text-muted-foreground">Bu form için henüz alan tanımlanmamış.</p>
        )}
      </div>

      <div className="rounded-lg border bg-card p-3.5 space-y-3">
        {requiredFields.length > 0 && (
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", !missingRequired ? "bg-emerald-500" : "bg-amber-500")}
              style={{ width: `${(filledRequiredCount / requiredFields.length) * 100}%` }}
            />
          </div>
        )}
        <Button onClick={() => onSubmit(values)} disabled={pending || missingRequired} className="w-full gap-2">
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Devam Et
        </Button>
        <p className={cn("text-xs font-medium", missingRequired ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
          {missingRequired
            ? "Devam etmeden önce zorunlu (*) alanları doldurun."
            : "Tüm zorunlu alanlar tamam, devam edebilirsiniz."}
        </p>
      </div>
    </div>
  )
}
