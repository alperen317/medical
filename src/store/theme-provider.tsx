"use client"

import { createContext, useContext, useEffect, useState } from "react"

export type Theme = "light" | "dark" | "system"

const STORAGE_KEY = "medpanel-theme"

const ThemeContext = createContext<{
  theme: Theme
  setTheme: (t: Theme) => void
  resolvedTheme: "light" | "dark"
}>({ theme: "system", setTheme: () => {}, resolvedTheme: "light" })

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system")
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light")

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null
    if (saved === "dark" || saved === "light") {
      setThemeState(saved)
    }
  }, [])

  useEffect(() => {
    const root = document.documentElement

    if (theme === "system") {
      localStorage.removeItem(STORAGE_KEY)
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
      root.setAttribute("data-theme", prefersDark ? "dark" : "light")
      setResolvedTheme(prefersDark ? "dark" : "light")
    } else {
      root.setAttribute("data-theme", theme)
      localStorage.setItem(STORAGE_KEY, theme)
      setResolvedTheme(theme)
    }
  }, [theme])

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = (e: MediaQueryListEvent) => {
      if (theme === "system") {
        document.documentElement.setAttribute("data-theme", e.matches ? "dark" : "light")
        setResolvedTheme(e.matches ? "dark" : "light")
      }
    }
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [theme])

  const setTheme = (t: Theme) => setThemeState(t)

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
