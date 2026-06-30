"use client"

import { useActionState, useEffect, useState } from "react"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { Plus, Loader2, Trash2, Check, Pencil, ChevronDown, X, MailCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { createUserAction, updateUserAction, updateUserRoleAction, deleteUserFormAction, resendInviteAction } from "@/lib/actions/users"
import type { UserListItem } from "@/lib/db/users"
import type { RoleWithCount } from "@/lib/db/roles"
import type { DepartmentListItem } from "@/lib/db/departments"
import { can } from "@/lib/permissions"
import { useT } from "@/store/translations-context"

type Props = {
  users: UserListItem[]
  roles: RoleWithCount[]
  departments: DepartmentListItem[]
  currentUserId: string
  currentUserPermissions: string[]
}

function RoleChangeBadge({
  user,
  roles,
  currentUserId,
  currentUserPermissions,
}: {
  user: UserListItem
  roles: RoleWithCount[]
  currentUserId: string
  currentUserPermissions: string[]
}) {
  const t = useT()
  const [, action] = useActionState(updateUserRoleAction, {})

  const isSelf = user.id === currentUserId
  const canUpdate = can(currentUserPermissions, "user:update")
  const canAssignSuperAdmin = currentUserPermissions.includes("settings:manage")
  const isTargetSuperAdmin = user.role.name === "super_admin"

  const changeAllowed = canUpdate && !isSelf && !(isTargetSuperAdmin && !canAssignSuperAdmin)

  const badge = (
    <Badge variant={user.role.name === "super_admin" ? "destructive" : user.role.name === "admin" ? "default" : "secondary"}>
      {user.role.label}
    </Badge>
  )

  if (!changeAllowed) return badge

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="focus:outline-none">
          <Badge
            variant={user.role.name === "super_admin" ? "destructive" : user.role.name === "admin" ? "default" : "secondary"}
            className="cursor-pointer hover:opacity-80 transition-opacity"
          >
            {user.role.label}
          </Badge>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t("user.role.assign_label")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {roles
          .filter((r) => r.name !== "super_admin" || canAssignSuperAdmin)
          .map((role) => (
            <DropdownMenuItem
              key={role.id}
              disabled={role.id === user.roleId}
              onSelect={() => {
                const fd = new FormData()
                fd.set("userId", user.id)
                fd.set("roleId", role.id)
                action(fd)
              }}
            >
              {role.label}
              {role.id === user.roleId && " ✓"}
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function DepartmentMultiSelect({
  departments,
  selected,
  onToggle,
}: {
  departments: DepartmentListItem[]
  selected: string[]
  onToggle: (id: string) => void
}) {
  const t = useT()
  const [open, setOpen] = useState(false)

  if (departments.length === 0) return null

  const selectedDepts = departments.filter((d) => selected.includes(d.id))

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">
        {t("user.table.departments")} <span className="text-muted-foreground font-normal">{t("patient.form.optional")}</span>
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring min-h-9"
        >
          <span className="flex flex-wrap gap-1 flex-1 min-w-0">
            {selectedDepts.length === 0 ? (
              <span className="text-muted-foreground">{t("user.field.dept_placeholder")}</span>
            ) : (
              selectedDepts.map((dept) => (
                <span
                  key={dept.id}
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium"
                  style={{ backgroundColor: dept.color + "20", color: dept.color }}
                >
                  <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: dept.color }} />
                  {dept.name}
                  <span
                    role="button"
                    tabIndex={0}
                    className="ml-0.5 hover:opacity-70"
                    onClick={(e) => { e.stopPropagation(); onToggle(dept.id) }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onToggle(dept.id) } }}
                  >
                    <X className="h-2.5 w-2.5" />
                  </span>
                </span>
              ))
            )}
          </span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ml-2 ${open ? "rotate-180" : ""}`} />
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-popover shadow-md">
              {departments.map((dept) => {
                const isSelected = selected.includes(dept.id)
                return (
                  <button
                    key={dept.id}
                    type="button"
                    onClick={() => onToggle(dept.id)}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent transition-colors first:rounded-t-md last:rounded-b-md"
                  >
                    <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-input">
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: dept.color }} />
                    <span className="flex-1 text-left">{dept.name}</span>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function AddUserDialog({
  roles,
  departments,
  currentUserPermissions,
}: {
  roles: RoleWithCount[]
  departments: DepartmentListItem[]
  currentUserPermissions: string[]
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(createUserAction, {})
  const [selectedDepts, setSelectedDepts] = useState<string[]>([])

  useEffect(() => {
    if (state?.success) {
      setOpen(false)
      setSelectedDepts([])
    }
  }, [state])

  const canAssignSuperAdmin = currentUserPermissions.includes("settings:manage")
  const availableRoles = roles.filter((r) => r.name !== "super_admin" || canAssignSuperAdmin)

  const toggleDept = (id: string) => {
    setSelectedDepts((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    )
  }

  const handleSubmit = (formData: FormData) => {
    selectedDepts.forEach((id) => formData.append("departmentIds", id))
    action(formData)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSelectedDepts([]) }}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          {t("user.invite.button")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("user.new.title")}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4 mt-2">
          {state?.message && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {state.message}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("user.field.name")}</label>
            <Input name="name" />
            {state?.errors?.name && (
              <p className="text-xs text-destructive">{state.errors.name[0]}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("user.field.email")}</label>
            <Input name="email" type="email" />
            {state?.errors?.email && (
              <p className="text-xs text-destructive">{state.errors.email[0]}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("user.field.role")}</label>
            <select
              name="roleId"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {availableRoles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.label}
                </option>
              ))}
            </select>
            {state?.errors?.roleId && (
              <p className="text-xs text-destructive">{state.errors.roleId[0]}</p>
            )}
          </div>

          <DepartmentMultiSelect
            departments={departments}
            selected={selectedDepts}
            onToggle={toggleDept}
          />

          <p className="text-xs text-muted-foreground bg-muted rounded-md px-3 py-2">
            {t("user.invite.email_hint")}
          </p>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              {t("action.cancel")}
            </Button>
            <Button type="submit" disabled={pending} className="flex-1">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("user.invite.submit")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ResendInviteButton({ userId, userName }: { userId: string; userName: string }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(resendInviteAction, {})

  useEffect(() => {
    if (state?.success) setOpen(false)
  }, [state])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          disabled={!!state?.success}
          className="text-muted-foreground hover:text-primary transition-colors p-1 disabled:opacity-50"
          title={state?.success ? t("user.status.pending_invite") : t("user.resend_invite.button")}
        >
          {state?.success ? (
            <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
          ) : (
            <MailCheck className="h-4 w-4" />
          )}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("user.resend_invite.title")}</DialogTitle>
        </DialogHeader>
        {!state?.success ? (
          <>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{userName}</span> {t("user.resend_invite.confirm")}
            </p>
            <form action={action}>
              <input type="hidden" name="userId" value={userId} />
              {state?.message && (
                <p className="mt-3 text-sm text-destructive">{state.message}</p>
              )}
              <div className="flex gap-3 mt-5">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
                  {t("action.cancel")}
                </Button>
                <Button type="submit" disabled={pending} className="flex-1">
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("action.send")}
                </Button>
              </div>
            </form>
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t("user.resend_invite.success_msg")}
            </p>
            {state.setupLink && (
              <div className="rounded-md border bg-muted p-3 space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">{t("user.resend_invite.setup_link_label")}</p>
                <p className="text-xs break-all font-mono text-foreground">{state.setupLink}</p>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => navigator.clipboard.writeText(state.setupLink!)}
                >
                  {t("action.copy")}
                </button>
              </div>
            )}
            <Button className="w-full" onClick={() => setOpen(false)}>{t("action.ok")}</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function EditUserDialog({
  user,
  roles,
  departments,
  currentUserId,
  currentUserPermissions,
}: {
  user: UserListItem
  roles: RoleWithCount[]
  departments: DepartmentListItem[]
  currentUserId: string
  currentUserPermissions: string[]
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(updateUserAction, {})
  const [selectedDepts, setSelectedDepts] = useState<string[]>(user.departments.map((d) => d.id))

  useEffect(() => {
    if (state?.success) setOpen(false)
  }, [state])

  const isSelf = user.id === currentUserId
  const canAssignSuperAdmin = currentUserPermissions.includes("settings:manage")
  const isTargetSuperAdmin = user.role.name === "super_admin"
  const editAllowed = !isSelf && !(isTargetSuperAdmin && !canAssignSuperAdmin)

  if (!editAllowed) return null

  const toggleDept = (id: string) => {
    setSelectedDepts((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    )
  }

  const handleSubmit = (formData: FormData) => {
    selectedDepts.forEach((id) => formData.append("departmentIds", id))
    action(formData)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) setSelectedDepts(user.departments.map((d) => d.id))
      }}
    >
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
          <DialogTitle>{t("user.edit.title")}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4 mt-2">
          <input type="hidden" name="userId" value={user.id} />

          {state?.message && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {state.message}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("user.field.name")}</label>
            <Input name="name" defaultValue={user.name} />
            {state?.errors?.name && (
              <p className="text-xs text-destructive">{state.errors.name[0]}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("user.field.email")}</label>
            <Input name="email" type="email" defaultValue={user.email} />
            {state?.errors?.email && (
              <p className="text-xs text-destructive">{state.errors.email[0]}</p>
            )}
          </div>

          <DepartmentMultiSelect
            departments={departments}
            selected={selectedDepts}
            onToggle={toggleDept}
          />

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              {t("action.cancel")}
            </Button>
            <Button type="submit" disabled={pending} className="flex-1">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("action.save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function UsersClient({ users, roles, departments, currentUserId, currentUserPermissions }: Props) {
  const t = useT()
  const canCreate = can(currentUserPermissions, "user:create")
  const canUpdate = can(currentUserPermissions, "user:update")
  const canDelete = can(currentUserPermissions, "user:delete")

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div />
        {canCreate && (
          <AddUserDialog
            roles={roles}
            departments={departments}
            currentUserPermissions={currentUserPermissions}
          />
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("user.table.user")}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("user.table.role")}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">{t("user.table.departments")}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">{t("user.table.registered")}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">{t("user.table.patients")}</th>
                  {(canUpdate || canDelete) && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((user) => {
                  const initials = user.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
                  const isSelf = user.id === currentUserId
                  return (
                    <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium leading-snug">
                              {user.name}
                              {isSelf && (
                                <span className="ml-1.5 text-xs text-muted-foreground font-normal">{t("user.self_label")}</span>
                              )}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <p className="text-xs text-muted-foreground">{user.email}</p>
                              {user.setupToken && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500 text-white whitespace-nowrap">
                                  <span className="h-1.5 w-1.5 rounded-full bg-white/70" />
                                  {t("user.status.pending_invite")}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <RoleChangeBadge
                          user={user}
                          roles={roles}
                          currentUserId={currentUserId}
                          currentUserPermissions={currentUserPermissions}
                        />
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {user.departments.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {user.departments.map((dept) => (
                              <span
                                key={dept.id}
                                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium border"
                                style={{ backgroundColor: dept.color + "15", borderColor: dept.color + "40", color: dept.color }}
                              >
                                <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: dept.color }} />
                                {dept.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                        {format(new Date(user.createdAt), "d MMM yyyy", { locale: tr })}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                        {user._count.patients}
                      </td>
                      {(canUpdate || canDelete) && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {canCreate && user.setupToken && !isSelf && (
                              <ResendInviteButton userId={user.id} userName={user.name} />
                            )}
                            {canUpdate && (
                              <EditUserDialog
                                user={user}
                                roles={roles}
                                departments={departments}
                                currentUserId={currentUserId}
                                currentUserPermissions={currentUserPermissions}
                              />
                            )}
                            {canDelete && !isSelf && user.role.name !== "super_admin" && (
                              <form action={deleteUserFormAction}>
                                <input type="hidden" name="userId" value={user.id} />
                                <button
                                  type="submit"
                                  className="text-muted-foreground hover:text-destructive transition-colors p-1"
                                  title={t("action.delete")}
                                  onClick={(e) => {
                                    if (!confirm(`${user.name} ${t("action.delete").toLowerCase()}?`)) {
                                      e.preventDefault()
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </form>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
