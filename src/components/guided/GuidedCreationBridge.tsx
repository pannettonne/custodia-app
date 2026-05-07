'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { GuidedCreationPanel } from './GuidedCreationPanelV2'

function findMoreGrid() {
  if (typeof document === 'undefined') return null
  return document.querySelector<HTMLElement>('.more-real-grid.more-tab-screen-grid, .more-real-grid')
}

export function GuidedCreationBridge() {
  const { user } = useAuth()
  const { children, selectedChildId } = useAppStore()
  const [moreGrid, setMoreGrid] = useState<HTMLElement | null>(null)
  const [open, setOpen] = useState(false)

  const child = useMemo(() => children.find(item => item.id === selectedChildId) ?? null, [children, selectedChildId])
  const canUseGuidedCreation = !!child && !!user?.uid && child.parents.includes(user.uid)

  useEffect(() => {
    if (typeof document === 'undefined') return
    const sync = () => setMoreGrid(findMoreGrid())
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const closeOnNavigate = () => setOpen(false)
    window.addEventListener('custodia:navigate', closeOnNavigate)
    return () => window.removeEventListener('custodia:navigate', closeOnNavigate)
  }, [])

  const card = moreGrid && canUseGuidedCreation
    ? createPortal(
        <button
          type="button"
          className="more-real-card guided-creation-card"
          style={{ '--more-tone': '#7c3aed', order: -20 } as CSSProperties}
          onClick={() => setOpen(true)}
        >
          <span className="more-real-card-copy">
            <span className="more-real-card-title">Creación guiada</span>
            <span className="more-real-card-subtitle">Evento paso a paso</span>
          </span>
          <span className="more-real-icon-wrap" aria-hidden="true">✨</span>
        </button>,
        moreGrid
      )
    : null

  const panel = open && typeof document !== 'undefined'
    ? createPortal(
        <div className="guided-creation-overlay" role="dialog" aria-modal="true" aria-label="Creación guiada">
          <div className="guided-creation-shell">
            <div className="guided-creation-topbar">
              <button type="button" className="guided-creation-back" onClick={() => setOpen(false)}>Volver a Más</button>
              <button type="button" className="guided-creation-close" aria-label="Cerrar creación guiada" onClick={() => setOpen(false)}>×</button>
            </div>
            <GuidedCreationPanel />
          </div>
        </div>,
        document.body
      )
    : null

  return <>{card}{panel}</>
}
