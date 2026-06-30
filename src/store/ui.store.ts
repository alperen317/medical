import { create } from "zustand"

export type ToastVariant = "success" | "error" | "warning" | "info"

export interface Toast {
  id: string
  message: string
  variant: ToastVariant
  duration?: number
}

interface UIState {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, "id">) => void
  removeToast: (id: string) => void
}

export const useUIStore = create<UIState>()((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = crypto.randomUUID()
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }))
    const duration = toast.duration ?? 4000
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
      }, duration)
    }
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))

// Kısa yol helper'lar
export const toast = {
  success: (message: string, duration?: number) =>
    useUIStore.getState().addToast({ message, variant: "success", duration }),
  error: (message: string, duration?: number) =>
    useUIStore.getState().addToast({ message, variant: "error", duration }),
  warning: (message: string, duration?: number) =>
    useUIStore.getState().addToast({ message, variant: "warning", duration }),
  info: (message: string, duration?: number) =>
    useUIStore.getState().addToast({ message, variant: "info", duration }),
}
