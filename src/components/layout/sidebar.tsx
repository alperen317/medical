"use client"

import React, { useState, useEffect, useTransition } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, Users,
  Settings, Activity, LogOut,
  UserCog, ShieldCheck, Building2, PanelLeftOpen, PanelLeftClose,
  CalendarDays, UserCheck, Languages, Sun, Moon, Monitor, Workflow, ClipboardList, FileStack,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { logoutAction } from "@/lib/actions/auth"
import { setLanguageAction } from "@/lib/actions/language"
import { useCurrentUser } from "@/store/session.store"
import { useT, useLang } from "@/store/translations-context"
import { useTheme, type Theme } from "@/store/theme-provider"
import { can, type Permission } from "@/lib/permissions"
import { LANGUAGES, type LangCode } from "@/lib/i18n/languages"

type NavItem = {
  href: string
  labelKey: string
  icon: React.ElementType
  permission?: Permission
  roles?: string[]
}

const clinicalNavItems: NavItem[] = [
  { href: "/dashboard",    labelKey: "nav.dashboard",    icon: LayoutDashboard },
  { href: "/patients",     labelKey: "nav.patients",     icon: Users, roles: ["super_admin"] },
  { href: "/appointments", labelKey: "nav.appointments", icon: CalendarDays },
  { href: "/my-patients",  labelKey: "nav.my_patients",  icon: UserCheck, roles: ["doctor", "doktor", "hekim"] },
  { href: "/clinicalos/intake", labelKey: "nav.patient_intake", icon: ClipboardList, permission: "intake:execute" },
  { href: "/activity",     labelKey: "nav.activity",     icon: Activity },
]

const adminNavItems: NavItem[] = [
  { href: "/clinicalos/studio",     labelKey: "nav.workflow_studio", icon: Workflow, permission: "workflow:manage" },
  { href: "/clinicalos/studio/forms", labelKey: "nav.form_builder", icon: FileStack, permission: "workflow:manage" },
  { href: "/settings/users",        labelKey: "nav.users",        icon: UserCog,    permission: "user:read" },
  { href: "/settings/departments",  labelKey: "nav.departments",  icon: Building2,  permission: "settings:manage" },
  { href: "/settings/roles",        labelKey: "nav.roles",        icon: ShieldCheck, permission: "settings:manage" },
  { href: "/settings/translations", labelKey: "nav.translations", icon: Languages,  permission: "settings:manage" },
  { href: "/settings",              labelKey: "nav.settings",     icon: Settings },
]

function NavSection({ label, items, pathname, permissions, roleName, collapsed }: {
  label: string
  items: NavItem[]
  pathname: string
  permissions: string[]
  roleName: string
  collapsed: boolean
}) {
  const t = useT()

  const visible = items.filter((item) => {
    if (item.permission && !can(permissions, item.permission)) return false
    if (item.roles && !item.roles.includes(roleName)) return false
    return true
  })

  if (visible.length === 0) return null

  // Birden fazla item pathname ile eşleşebilir (ör. /clinicalos/studio ve
  // /clinicalos/studio/forms); yalnızca en uzun (en spesifik) href aktif sayılır.
  const activeHref = visible.reduce<string | null>((best, item) => {
    const matches =
      pathname === item.href ||
      (item.href !== "/settings" && pathname.startsWith(item.href + "/"))
    if (!matches) return best
    if (!best || item.href.length > best.length) return item.href
    return best
  }, null)

  return (
    <div>
      {!collapsed && (
        <p className="px-4 pt-4 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted-foreground/60 select-none">
          {label}
        </p>
      )}
      {collapsed && <div className="pt-4" />}
      <div className={cn("space-y-0.5", collapsed ? "px-2" : "px-3")}>
        {visible.map((item) => {
          const Icon = item.icon
          const itemLabel = t(item.labelKey as Parameters<typeof t>[0])
          const isActive = item.href === activeHref
          const link = (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center rounded-lg transition-colors",
                collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5",
                "text-sm font-medium",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && itemLabel}
            </Link>
          )

          if (collapsed) {
            return (
              <Tooltip key={item.href} delayDuration={0}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{itemLabel}</TooltipContent>
              </Tooltip>
            )
          }

          return link
        })}
      </div>
    </div>
  )
}

function LanguageSwitcher({ collapsed }: { collapsed: boolean }) {
  const lang = useLang()
  const [isPending, startTransition] = useTransition()

  function switchLang(next: LangCode) {
    if (next === lang || isPending) return
    startTransition(async () => {
      await setLanguageAction(next)
    })
  }

  const button = (
    <div className={cn("flex items-center", collapsed ? "flex-col gap-1" : "gap-1 px-4 py-2")}>
      {(Object.keys(LANGUAGES) as LangCode[]).map((code) => (
        <button
          key={code}
          onClick={() => switchLang(code)}
          disabled={isPending}
          className={cn(
            "rounded px-2 py-0.5 text-xs font-semibold transition-colors disabled:opacity-50",
            code === lang
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
          )}
        >
          {collapsed ? LANGUAGES[code].nativeLabel : `${LANGUAGES[code].flag} ${LANGUAGES[code].nativeLabel}`}
        </button>
      ))}
    </div>
  )

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <div className="flex justify-center py-1">{button}</div>
        </TooltipTrigger>
        <TooltipContent side="right">
          {lang === "tr" ? "Switch to English" : "Türkçe'ye Geç"}
        </TooltipContent>
      </Tooltip>
    )
  }

  return button
}

const THEME_CYCLE: Theme[] = ["system", "light", "dark"]
const THEME_ICONS: Record<Theme, React.ElementType> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
}
const THEME_LABELS: Record<Theme, string> = {
  system: "Sistem",
  light: "Açık",
  dark: "Koyu",
}

function ThemeToggle({ collapsed }: { collapsed: boolean }) {
  const { theme, setTheme } = useTheme()

  const cycle = () => {
    const next = THEME_CYCLE[(THEME_CYCLE.indexOf(theme) + 1) % THEME_CYCLE.length]
    setTheme(next)
  }

  const Icon = THEME_ICONS[theme]
  const label = THEME_LABELS[theme]

  const button = (
    <button
      onClick={cycle}
      className={cn(
        "flex items-center rounded-md transition-colors text-xs font-medium",
        "text-sidebar-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/60",
        collapsed ? "justify-center p-2" : "gap-2 px-4 py-2 w-full"
      )}
      title={label}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {!collapsed && label}
    </button>
  )

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <div className="flex justify-center py-1">{button}</div>
        </TooltipTrigger>
        <TooltipContent side="right">Tema: {label}</TooltipContent>
      </Tooltip>
    )
  }

  return <div className="py-1">{button}</div>
}

export function Sidebar() {
  const pathname = usePathname()
  const user = useCurrentUser()
  const t = useT()
  const permissions = user?.permissions ?? []
  const roleName = user?.roleName ?? ""
  const initials = user?.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase() ?? "?"

  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed")
    if (saved !== null) setCollapsed(saved === "true")
  }, [])

  const toggle = () => {
    setCollapsed((prev) => {
      localStorage.setItem("sidebar-collapsed", String(!prev))
      return !prev
    })
  }

  const hasAdminNav = adminNavItems.some((item) => {
    if (!item.permission) return true
    return can(permissions, item.permission)
  })

  return (
    <TooltipProvider>
      <aside
        className={cn(
          "flex h-screen flex-col bg-sidebar-background dark:bg-card text-sidebar-foreground transition-all duration-200",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Logo + Toggle */}
        {collapsed ? (
          <div className="flex h-16 items-center justify-center shrink-0">
            <button
              onClick={toggle}
              className="text-sidebar-muted-foreground hover:text-sidebar-accent-foreground transition-colors"
              title="Genişlet"
            >
              <PanelLeftOpen className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <div className="flex h-16 items-center justify-between px-4 shrink-0">
            <Image src="/logo.svg" alt="Yeditepe Hasta Yönetim Paneli AI Projesi" height={32} width={160} className="object-contain" />
            <button
              onClick={toggle}
              className="text-sidebar-muted-foreground hover:text-sidebar-accent-foreground transition-colors shrink-0"
              title="Daralt"
            >
              <PanelLeftClose className="h-5 w-5" />
            </button>
          </div>
        )}

        <Separator className="bg-sidebar-border" />

        {/* Navigation */}
        <nav className="flex-1 py-2 overflow-y-auto">
          <NavSection
            label={t("nav.section.clinical")}
            items={clinicalNavItems}
            pathname={pathname}
            permissions={permissions}
            roleName={roleName}
            collapsed={collapsed}
          />

          {hasAdminNav && (
            <>
              <Separator className="bg-sidebar-border my-2" />
              <NavSection
                label={t("nav.section.admin")}
                items={adminNavItems}
                pathname={pathname}
                permissions={permissions}
                roleName={roleName}
                collapsed={collapsed}
              />
            </>
          )}
        </nav>

        <Separator className="bg-sidebar-border" />

        {/* Language + Theme */}
        <LanguageSwitcher collapsed={collapsed} />
        <ThemeToggle collapsed={collapsed} />

        <Separator className="bg-sidebar-border" />

        {/* User Profile */}
        <div className={cn(
          "flex items-center py-4",
          collapsed ? "justify-center px-0 flex-col gap-2" : "gap-3 px-4"
        )}>
          {collapsed ? (
            <>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Avatar className="h-8 w-8 cursor-default">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p className="font-medium">{user?.name ?? "—"}</p>
                  <p className="text-xs opacity-70">{user?.roleName ?? ""}</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <form action={logoutAction}>
                    <button
                      type="submit"
                      title={t("action.logout")}
                      className="text-sidebar-muted-foreground hover:text-sidebar-foreground transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                    </button>
                  </form>
                </TooltipTrigger>
                <TooltipContent side="right">{t("action.logout")}</TooltipContent>
              </Tooltip>
            </>
          ) : (
            <>
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.name ?? "—"}</p>
                <p className="text-xs text-sidebar-muted-foreground truncate">
                  {user?.roleName ?? ""}
                </p>
              </div>
              <form action={logoutAction}>
                <button
                  type="submit"
                  title={t("action.logout")}
                  className="text-sidebar-muted-foreground hover:text-sidebar-foreground transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </form>
            </>
          )}
        </div>
      </aside>
    </TooltipProvider>
  )
}
