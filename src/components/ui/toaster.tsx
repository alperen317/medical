"use client"

import { useUIStore } from "@/store/ui.store"
import { cn } from "@/lib/utils"
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react"

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
}

const styles = {
  success: "bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800/60 text-green-800 dark:text-green-300",
  error: "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800/60 text-red-800 dark:text-red-300",
  warning: "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300",
  info: "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/60 text-blue-800 dark:text-blue-300",
}

const iconStyles = {
  success: "text-green-500",
  error: "text-red-500",
  warning: "text-amber-500",
  info: "text-blue-500",
}

export function Toaster() {
  const { toasts, removeToast } = useUIStore()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
      {toasts.map((toast) => {
        const Icon = icons[toast.variant]
        return (
          <div
            key={toast.id}
            className={cn(
              "flex items-start gap-3 rounded-lg border px-4 py-3 shadow-md",
              "animate-in slide-in-from-right-5 fade-in duration-200",
              styles[toast.variant]
            )}
          >
            <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", iconStyles[toast.variant])} />
            <p className="flex-1 text-sm font-medium">{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
