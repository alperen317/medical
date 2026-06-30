"use client"

import { useRef } from "react"
import type { SessionUser } from "@/lib/dal"
import {
  SessionContext,
  createSessionStore,
  type SessionStore,
} from "@/store/session.store"

export function SessionProvider({
  children,
  user,
}: {
  children: React.ReactNode
  user: SessionUser | null
}) {
  const storeRef = useRef<SessionStore>(null)
  if (!storeRef.current) {
    storeRef.current = createSessionStore(user)
  }
  return (
    <SessionContext.Provider value={storeRef.current}>
      {children}
    </SessionContext.Provider>
  )
}
