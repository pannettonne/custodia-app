'use client'

import { useEffect, useRef, useState } from 'react'
import { GlobalSearchOverlay } from '@/components/ui/GlobalSearchOverlay'

type Tab = 'today' | 'calendar' | 'requests' | 'events' | 'more' | 'notes' | 'documents' | 'packing' | 'contacts' | 'medications' | 'stats' | 'settings' | 'blocks'
type FocusTarget = { id: string; seq: number } | null

export function GlobalSearchBridge() {
  const [open, setOpen] = useState(false)
  const nextFocusTargetRef = useRef<FocusTarget>(null)

  useEffect(() => {
    if (typeof document === 'undefined') return

    const openFromHeaderButton = (event: MouseEvent) => {
      const target = event.target as Element | null
      const button = target?.closest('button[title="Buscar"]')
      if (!button) return
      event.preventDefault()
      event.stopPropagation()
      setOpen(true)
    }

    document.addEventListener('click', openFromHeaderButton, true)
    return () => document.removeEventListener('click', openFromHeaderButton, true)
  }, [])

  const navigate = (tab: Tab) => {
    const focusTarget = nextFocusTargetRef.current
    nextFocusTargetRef.current = null

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('custodia:navigate', {
        detail: {
          tab,
          focusTargetId: focusTarget?.id,
        },
      }))
    }
  }

  return (
    <GlobalSearchOverlay
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      navigate={navigate}
      setFocusTarget={target => { nextFocusTargetRef.current = target }}
    />
  )
}
