'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { GuidedCreationPanel } from './GuidedCreationPanelV9'

type GuidedEditTarget = {
  type: 'event' | 'change' | 'block' | 'treatment' | 'note'
  item: any
}

function findMoreGrid() {
  if (typeof document === 'undefined') return null
  return document.querySelector<HTMLElement>('.more-real-grid.more-tab-screen-grid, .more-real-grid')
}

export function GuidedCreationBridge() {
  const { user } = useAuth()
  const { children, selectedChildId, setSelectedChildId } = useAppStore()
  const [moreGrid, setMoreGrid] = useState<HTMLElement | null>(null)
  const [open, setOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<GuidedEditTarget | null>(null)

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
    const closeOnNavigate = () => {
      setOpen(false)
      setEditTarget(null)
    }
    window.addEventListener('custodia:navigate', closeOnNavigate)
    return () => window.removeEventListener('custodia:navigate', closeOnNavigate)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const openEditor = (event: Event) => {
      const detail = (event as CustomEvent<GuidedEditTarget>).detail
      if (!detail?.type || !detail?.item) return
      if (detail.item.childId) setSelectedChildId(detail.item.childId)
      setEditTarget(detail)
      setOpen(true)
    }
    window.addEventListener('custodia:guided-edit', openEditor as EventListener)
    return () => window.removeEventListener('custodia:guided-edit', openEditor as EventListener)
  }, [setSelectedChildId])

  const close = () => {
    setOpen(false)
    setEditTarget(null)
  }

  const card = moreGrid && canUseGuidedCreation
    ? createPortal(
        <button
          type="button"
          className="more-real-card guided-creation-card"
          style={{ '--more-tone': '#7c3aed', order: -20 } as CSSProperties}
          onClick={() => { setEditTarget(null); setOpen(true) }}
        >
          <span className="more-real-card-copy">
            <span className="more-real-card-title">Creación guiada</span>
            <span className="more-real-card-subtitle">Crear paso a paso</span>
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
              <button type="button" className="guided-creation-back" onClick={close}>{editTarget ? 'Cerrar edición' : 'Volver a Más'}</button>
              <button type="button" className="guided-creation-close" aria-label="Cerrar creación guiada" onClick={close}>×</button>
            </div>
            <GuidedCreationPanel key={editTarget ? `${editTarget.type}-${editTarget.item.id}` : 'create'} editTarget={editTarget} onDone={close} />
          </div>
        </div>,
        document.body
      )
    : null

  return <>{card}{panel}</>
}
