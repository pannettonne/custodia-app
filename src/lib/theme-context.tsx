'use client'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'

export type ThemeMode = 'system' | 'light' | 'dark'

type ThemeContextValue = {
  mode: ThemeMode
  resolvedTheme: 'light' | 'dark'
  setMode: (mode: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(mode: ThemeMode) {
  const resolved = mode === 'system' ? getSystemTheme() : mode
  document.documentElement.setAttribute('data-theme', resolved)
  return resolved
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('system')
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('dark')

  useEffect(() => {
    const saved = (localStorage.getItem('custodia-theme-mode') as ThemeMode | null) || 'system'
    setModeState(saved)
    setResolvedTheme(applyTheme(saved))
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      setResolvedTheme(prev => {
        const saved = (localStorage.getItem('custodia-theme-mode') as ThemeMode | null) || 'system'
        if (saved !== 'system') return prev
        return applyTheme('system')
      })
    }
    media.addEventListener?.('change', onChange)
    return () => media.removeEventListener?.('change', onChange)
  }, [])

  const setMode = (next: ThemeMode) => {
    localStorage.setItem('custodia-theme-mode', next)
    setModeState(next)
    setResolvedTheme(applyTheme(next))
  }

  const value = useMemo(() => ({ mode, resolvedTheme, setMode }), [mode, resolvedTheme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
