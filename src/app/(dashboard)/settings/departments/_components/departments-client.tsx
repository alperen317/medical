"use client"

import { useActionState, useEffect, useState } from "react"
import { Plus, Loader2, Trash2, Pencil, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  createDepartmentAction,
  updateDepartmentAction,
  deleteDepartmentAction,
} from "@/lib/actions/departments"
import type { DepartmentListItem } from "@/lib/db/departments"
import { useT } from "@/store/translations-context"

const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#06b6d4",
]

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {PRESET_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
          style={{
            backgroundColor: color,
            borderColor: value === color ? "#fff" : "transparent",
            outline: value === color ? `2px solid ${color}` : "none",
            outlineOffset: "2px",
          }}
          onClick={() => onChange(color)}
        />
      ))}
    </div>
  )
}

function DepartmentForm({
  action,
  state,
  pending,
  defaultValues,
  onCancel,
}: {
  action: (payload: FormData) => void
  state: { errors?: { name?: string[]; description?: string[] }; message?: string }
  pending: boolean
  defaultValues?: { id?: string; name?: string; description?: string; color?: string }
  onCancel: () => void
}) {
  const t = useT()
  const [color, setColor] = useState(defaultValues?.color ?? "#6366f1")

  return (
    <form action={action} className="space-y-4 mt-2">
      {defaultValues?.id && <input type="hidden" name="id" value={defaultValues.id} />}
      <input type="hidden" name="color" value={color} />

      {state?.message && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
          {state.message}
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-sm font-medium">{t("department.field.name")}</label>
        <Input name="name" defaultValue={defaultValues?.name} />
        {state?.errors?.name && (
          <p className="text-xs text-destructive">{state.errors.name[0]}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">
          {t("common.description")} <span className="text-muted-foreground font-normal">{t("patient.form.optional")}</span>
        </label>
        <Input name="description" defaultValue={defaultValues?.description ?? ""} />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">{t("department.field.color")}</label>
        <ColorPicker value={color} onChange={setColor} />
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          {t("action.cancel")}
        </Button>
        <Button type="submit" disabled={pending} className="flex-1">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : defaultValues?.id ? t("action.update") : t("action.create")}
        </Button>
      </div>
    </form>
  )
}

function AddDepartmentDialog() {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(createDepartmentAction, {})

  useEffect(() => {
    if (state?.success) setOpen(false)
  }, [state])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          {t("department.add.button")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("department.new.title")}</DialogTitle>
        </DialogHeader>
        <DepartmentForm
          action={action}
          state={state}
          pending={pending}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function EditDepartmentDialog({ department }: { department: DepartmentListItem }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(updateDepartmentAction, {})

  useEffect(() => {
    if (state?.success) setOpen(false)
  }, [state])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground transition-colors p-1"
          title={t("action.edit")}
        >
          <Pencil className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("department.edit.title")}</DialogTitle>
        </DialogHeader>
        <DepartmentForm
          action={action}
          state={state}
          pending={pending}
          defaultValues={{
            id: department.id,
            name: department.name,
            description: department.description ?? "",
            color: department.color,
          }}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

type Props = {
  departments: DepartmentListItem[]
}

export function DepartmentsClient({ departments }: Props) {
  const t = useT()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div />
        <AddDepartmentDialog />
      </div>

      {departments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <Users className="h-10 w-10 text-muted-foreground/40" />
            <p className="font-medium text-muted-foreground">{t("department.empty")}</p>
            <p className="text-sm text-muted-foreground">{t("department.empty.hint")}</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("department.table.department")}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">{t("common.description")}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("user.table.user")}</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {departments.map((dept) => (
                    <tr key={dept.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="h-3 w-3 rounded-full shrink-0"
                            style={{ backgroundColor: dept.color }}
                          />
                          <span className="font-medium">{dept.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                        {dept.description ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary">
                          {dept._count.users} {t("department.user_suffix")}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <EditDepartmentDialog department={dept} />
                          <form action={deleteDepartmentAction}>
                            <input type="hidden" name="id" value={dept.id} />
                            <button
                              type="submit"
                              className="text-muted-foreground hover:text-destructive transition-colors p-1"
                              title={t("action.delete")}
                              onClick={(e) => {
                                if (dept._count.users > 0) {
                                  if (!confirm(`"${dept.name}" ${t("department.table.department").toLowerCase()} ${dept._count.users} ${t("department.user_suffix")} ${t("common.yes").toLowerCase()}. ${t("action.delete")}?`)) {
                                    e.preventDefault()
                                  }
                                } else {
                                  if (!confirm(`"${dept.name}" ${t("department.table.department").toLowerCase()} ${t("action.delete").toLowerCase()}?`)) {
                                    e.preventDefault()
                                  }
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
