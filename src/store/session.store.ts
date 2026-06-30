import { createContext, useContext } from "react"
import { createStore, useStore } from "zustand"
import type { SessionUser } from "@/lib/dal"

export interface SessionState {
  user: SessionUser | null
  setUser: (user: SessionUser) => void
  clearUser: () => void
}

export type SessionStore = ReturnType<typeof createSessionStore>

export function createSessionStore(initialUser: SessionUser | null) {
  return createStore<SessionState>()((set) => ({
    user: initialUser,
    setUser: (user) => set({ user }),
    clearUser: () => set({ user: null }),
  }))
}

export const SessionContext = createContext<SessionStore | null>(null)

export function useSessionStore<T>(selector: (state: SessionState) => T): T {
  const store = useContext(SessionContext)
  if (!store) throw new Error("SessionProvider eksik — layout.tsx'e ekleyin")
  return useStore(store, selector)
}

export function useCurrentUser() {
  return useSessionStore((s) => s.user)
}
