"use client"

import { useActionState, useState } from "react"
import { Plus, Loader2, Lock, Pencil, Trash2, Check, X, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  createRoleAction,
  updateRolePermissionsAction,
  updateRoleLabelAction,
  deleteRoleAction,
} from "@/lib/actions/roles"
import type { RoleWithCount } from "@/lib/db/roles"
import { ALL_PERMISSIONS, PERMISSION_LABELS, PERMISSION_CATEGORIES } from "@/lib/permissions"
import { useT } from "@/store/translations-context"

type Props = { roles: RoleWithCount[] }

function PermissionGrid({
  roleId,
  currentPermissions,
  isSystem,
  isSuperAdmin,
}: {
  roleId: string
  currentPermissions: string[]
  isSystem: boolean
  isSuperAdmin: boolean
}) {
  const t = useT()
  const [selected, setSelected] = useState<Set<string>>(new Set(currentPermissions))
  const [state, action, pending] = useActionState(updateRolePermissionsAction, {})
  const [dirty, setDirty] = useState(false)

  const toggle = (perm: string) => {
    if (isSuperAdmin) return
    const next = new Set(selected)
    if (next.has(perm)) next.delete(perm)
    else next.add(perm)
    setSelected(next)
    setDirty(true)
  }

  if (state.success && dirty) setDirty(false)

  return (
    <div className="space-y-3">
      {state.message && (
        <p className="text-xs text-destructive">{state.message}</p>
      )}
      {state.success && !dirty && (
        <p className="text-xs text-green-600 dark:text-green-400">{t("role.permissions.saved")}</p>
      )}

      {PERMISSION_CATEGORIES.map((cat) => (
        <div key={cat.label}>
          <p className="text-xs font-semibold text-muted-foreground mb-1.5">{cat.label}</p>
          <div className="grid grid-cols-2 gap-1">
            {cat.permissions.map((perm) => {
              const granted = selected.has(perm)
              return (
                <button
                  key={perm}
                  type="button"
                  onClick={() => toggle(perm)}
                  disabled={isSuperAdmin}
                  className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs text-left transition-colors ${
                    granted
                      ? "bg-primary/10 text-primary font-medium"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  } ${isSuperAdmin ? "cursor-default opacity-70" : "cursor-pointer"}`}
                >
                  <span className="shrink-0 w-3 text-center">{granted ? "✓" : ""}</span>
                  {PERMISSION_LABELS[perm]}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {!isSuperAdmin && dirty && (
        <form action={action} className="pt-1">
          <input type="hidden" name="roleId" value={roleId} />
          {[...selected].map((p) => (
            <input key={p} type="hidden" name={`perm_${p}`} value="on" />
          ))}
          <Button type="submit" size="sm" disabled={pending} className="gap-1.5">
            {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            {t("action.save")}
          </Button>
        </form>
      )}
    </div>
  )
}

function RoleLabelEditor({ roleId, currentLabel }: { roleId: string; currentLabel: string }) {
  const t = useT()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(currentLabel)
  const [state, action, pending] = useActionState(updateRoleLabelAction, {})

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
        title={t("action.edit")}
      >
        <Pencil className="h-3 w-3" />
      </button>
    )
  }

  return (
    <form
      action={action}
      className="flex items-center gap-1"
      onSubmit={() => setEditing(false)}
    >
      <input type="hidden" name="roleId" value={roleId} />
      <Input
        name="label"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-7 text-sm w-36"
        autoFocus
      />
      <Button type="submit" size="icon" className="h-7 w-7" disabled={pending}>
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
      </Button>
      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(false)}>
        <X className="h-3 w-3" />
      </Button>
      {state.message && <p className="text-xs text-destructive">{state.message}</p>}
    </form>
  )
}

function DeleteRoleButton({ roleId, roleName, userCount }: { roleId: string; roleName: string; userCount: number }) {
  const t = useT()
  const [state, action, pending] = useActionState(deleteRoleAction, {})

  return (
    <form action={action}>
      <input type="hidden" name="roleId" value={roleId} />
      {state.message && <p className="text-xs text-destructive mb-1">{state.message}</p>}
      <Button
        type="submit"
        size="sm"
        variant="ghost"
        disabled={pending || userCount > 0}
        className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
        title={userCount > 0 ? `${userCount} ${t("user.table.user").toLowerCase()} ${t("user.table.role").toLowerCase()}` : t("action.delete")}
        onClick={(e) => {
          if (!confirm(`"${roleName}" ${t("action.delete").toLowerCase()}?`)) {
            e.preventDefault()
          }
        }}
      >
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
        {t("action.delete")}
      </Button>
    </form>
  )
}

function NewRoleDialog() {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(createRoleAction, {})
  const [selected, setSelected] = useState<Set<string>>(new Set())

  if (state.success && open) setOpen(false)

  const toggle = (perm: string) => {
    const next = new Set(selected)
    if (next.has(perm)) next.delete(perm)
    else next.add(perm)
    setSelected(next)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          {t("role.new.button")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("role.new.title")}</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4 mt-2">
          {state.message && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {state.message}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("role.field.system_name")}</label>
              <Input name="name" placeholder="ornek_rol" />
              <p className="text-xs text-muted-foreground">{t("role.field.system_name.hint")}</p>
              {state?.errors?.name && (
                <p className="text-xs text-destructive">{state.errors.name[0]}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("role.field.display_name")}</label>
              <Input name="label" />
              {state?.errors?.label && (
                <p className="text-xs text-destructive">{state.errors.label[0]}</p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">{t("role.field.permissions")}</p>
            {PERMISSION_CATEGORIES.map((cat) => (
              <div key={cat.label}>
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">{cat.label}</p>
                <div className="grid grid-cols-2 gap-1">
                  {cat.permissions.map((perm) => {
                    const granted = selected.has(perm)
                    return (
                      <button
                        key={perm}
                        type="button"
                        onClick={() => toggle(perm)}
                        className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs text-left transition-colors ${
                          granted
                            ? "bg-primary/10 text-primary font-medium"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        } cursor-pointer`}
                      >
                        <span className="shrink-0 w-3 text-center">{granted ? "✓" : ""}</span>
                        {PERMISSION_LABELS[perm]}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
            {[...selected].map((p) => (
              <input key={p} type="hidden" name={`perm_${p}`} value="on" />
            ))}
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              {t("action.cancel")}
            </Button>
            <Button type="submit" disabled={pending} className="flex-1">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("action.create")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function RolesClient({ roles }: Props) {
  const t = useT()
  const [expanded, setExpanded] = useState<string | null>(roles[0]?.id ?? null)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div />
        <NewRoleDialog />
      </div>

      <div className="space-y-3">
        {roles.map((role) => {
          const isSuperAdmin = role.name === "super_admin"
          const isExpanded = expanded === role.id

          return (
            <Card key={role.id} className={isExpanded ? "ring-1 ring-primary/20" : ""}>
              <CardHeader
                className="py-3 px-4 cursor-pointer select-none"
                onClick={() => setExpanded(isExpanded ? null : role.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      {role.isSystem ? (
                        <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      ) : null}
                      {isExpanded && !isSuperAdmin ? (
                        <RoleLabelEditor roleId={role.id} currentLabel={role.label} />
                      ) : (
                        <span>{role.label}</span>
                      )}
                    </CardTitle>
                    <Badge variant="outline" className="text-xs font-mono">
                      {role.name}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 ml-2 shrink-0">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" />
                      {role._count.users}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {role.permissions.length} {t("role.permission_count_suffix")}
                    </span>
                    {!role.isSystem && (
                      <DeleteRoleButton
                        roleId={role.id}
                        roleName={role.label}
                        userCount={role._count.users}
                      />
                    )}
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-0 px-4 pb-4">
                  <div className="border-t pt-4">
                    <PermissionGrid
                      roleId={role.id}
                      currentPermissions={role.permissions}
                      isSystem={role.isSystem}
                      isSuperAdmin={isSuperAdmin}
                    />
                  </div>
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
