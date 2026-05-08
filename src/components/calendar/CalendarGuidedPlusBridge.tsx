'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAppStore } from '@/store/app'
import { GuidedCreationPanel } from '@/components/guided/GuidedCreationPanelV9'

export function CalendarGuidedPlusBridge() {
  const { selectedCalendarDate, setSelectedCalendarDate } = useAppStore()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (typeof document === 'undefined') return

    const capture = (event: MouseEvent) => {
      const button = (event.target as HTMLElement | null)?.closest('button[aria-label="Abrir acciones rápidas del día"]')
      if (!button) return
      event.preventDefault()
      event.stopPropagation()
      if (selectedCalendarDate) setSelectedCalendarDate(selectedCalendarDate)
      setOpen(true)
    }

    document.addEventListener('click', capture, true)
    return () => document.removeEventListener('click', capture, true)
  }, [selectedCalendarDate, setSelectedCalendarDate])

  const close = () => setOpen(false)

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="guided-creation-overlay" role="dialog" aria-modal="true" aria-label="Creación guiada">
      <div className="guided-creation-shell">
        <div className="guided-creation-topbar">
          <button type="button" className="guided-creation-back" onClick={close}>Volver al calendario</button>
          <button type="button" className="guided-creation-close" aria-label="Cerrar creación guiada" onClick={close}>×</button>
        </div>
        <GuidedCreationPanel onDone={close} />
      </div>
    </div>,
    document.body
  )
}
