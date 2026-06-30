"use client"

import { NotificationBell } from "@/components/layout/notification-bell"

interface HeaderProps {
  title: string
  subtitle?: string
}

export function Header({ title, subtitle }: HeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-6">
      <div className="flex items-baseline gap-3">
        <h1 className="text-base font-semibold tracking-tight text-foreground">{title}</h1>
        {subtitle && (
          <span className="hidden text-xs text-muted-foreground sm:block">{subtitle}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <NotificationBell />
      </div>
    </header>
  )
}
