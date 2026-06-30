"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatDistanceToNow } from "date-fns"
import { tr } from "date-fns/locale"

interface Notification {
  id: string
  type: string
  title: string
  body: string
  entityType: string | null
  entityId: string | null
  read: boolean
  createdAt: string
}

function getNotificationHref(n: Notification): string | null {
  if (!n.entityType || !n.entityId) return null
  if (n.entityType === "patient") return `/patients/${n.entityId}`
  if (n.entityType === "appointment") return `/appointments`
  return null
}

export function NotificationBell() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(0)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const fetchCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/count")
      const data = await res.json()
      setCount(data.count ?? 0)
    } catch {}
  }, [])

  useEffect(() => {
    fetchCount()
    const id = setInterval(fetchCount, 30_000)
    return () => clearInterval(id)
  }, [fetchCount])

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((data) => setNotifications(data.notifications ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  async function markAllRead() {
    await fetch("/api/notifications/read", { method: "PATCH" })
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setCount(0)
  }

  async function markOneRead(id: string) {
    await fetch("/api/notifications/read", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    setCount((c) => Math.max(0, c - 1))
  }

  async function handleNotificationClick(n: Notification) {
    if (!n.read) await markOneRead(n.id)
    const href = getNotificationHref(n)
    if (href) {
      setOpen(false)
      router.push(href)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setOpen((v) => !v)}
        aria-label="Bildirimler"
      >
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]">
            {count > 99 ? "99+" : count}
          </Badge>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border bg-background shadow-lg z-50">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <span className="font-medium text-sm">Bildirimler</span>
            {count > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Tümünü okundu işaretle
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Yükleniyor...</div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Bildirim yok</div>
            ) : (
              notifications.map((n) => {
                const href = getNotificationHref(n)
                return (
                <div
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && handleNotificationClick(n)}
                  onClick={() => handleNotificationClick(n)}
                  className={`flex gap-3 px-4 py-3 hover:bg-muted/50 border-b last:border-b-0 transition-colors ${
                    !n.read ? "bg-[var(--status-info)]/40" : ""
                  } ${href ? "cursor-pointer" : n.read ? "cursor-default" : "cursor-pointer"}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: tr })}
                    </p>
                  </div>
                  {!n.read && (
                    <div className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0 mt-2" />
                  )}
                </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
