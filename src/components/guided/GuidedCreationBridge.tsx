'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { formatAvailabilityBlockLabel } from '@/lib/availability-blocks'
import { GuidedCreationPanel } from './GuidedCreationPanelV9'

type GuidedEditTarget = {
  type: 'event' | 'change' | 'block' | 'treatment' | 'note'
  item: any
}

function findMoreGrid() {
  if (typeof document === 'undefined') return null
  return document.querySelector<HTMLElement>('.more-real-grid.more-tab-screen-grid, .more-real-grid')
}

function includesText(haystack: string, needle?: string) {
  return !!needle && haystack.includes(needle.toLowerCase())
}

export function GuidedCreationBridge() {
  const { user } = useAuth()
  const { children, selectedChildId, setSelectedChildId, events, notes, medications, availabilityBlocks, requests } = useAppStore()
  const [moreGrid, setMoreGrid] = useState<HTMLElement | null>(null)
  const [open, setOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<GuidedEditTarget | null>(null)

  const child = useMemo(() => children.find(item => item.id === selectedChildId) ?? null, [children, selectedChildId])
  const canUseGuidedCreation = !!child && !!user?.uid && child.parents.includes(user.uid)

  const openGuidedEditor = (target: GuidedEditTarget) => {
    if (target.item?.childId) setSelectedChildId(target.item.childId)
    setEditTarget(target)
    setOpen(true)
  }

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
      openGuidedEditor(detail)
    }
    window.addEventListener('custodia:guided-edit', openEditor as EventListener)
    return () => window.removeEventListener('custodia:guided-edit', openEditor as EventListener)
  }, [setSelectedChildId])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const injectBlockEditButtons = () => {
      const ownCards = Array.from(document.querySelectorAll<HTMLElement>('.card')).filter(card => (card.textContent || '').toLowerCase().includes('tu bloqueo'))
      ownCards.forEach(card => {
        if (card.querySelector('[data-guided-block-edit="true"]')) return
        const cardText = (card.textContent || '').toLowerCase()
        const block = availabilityBlocks.find(item => item.userId === user?.uid && cardText.includes(formatAvailabilityBlockLabel(item).toLowerCase()))
        if (!block) return
        const deleteButton = Array.from(card.querySelectorAll('button')).find(button => (button.textContent || '').trim().toLowerCase() === 'eliminar')
        if (!deleteButton?.parentElement) return
        const button = document.createElement('button')
        button.type = 'button'
        button.textContent = 'Editar'
        button.dataset.guidedBlockEdit = 'true'
        button.className = 'req-action-btn btn-accept'
        button.addEventListener('click', event => {
          event.preventDefault()
          event.stopPropagation()
          openGuidedEditor({ type: 'block', item: block })
        })
        deleteButton.parentElement.insertBefore(button, deleteButton)
      })
    }
    injectBlockEditButtons()
    const observer = new MutationObserver(injectBlockEditButtons)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [availabilityBlocks, user?.uid, setSelectedChildId])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const captureEditClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      const button = target?.closest('button')
      if (!button) return
      const label = `${button.getAttribute('aria-label') || ''} ${button.getAttribute('title') || ''} ${button.textContent || ''}`.toLowerCase()
      if (!label.includes('editar')) return
      const card = button.closest('.card') as HTMLElement | null
      const text = (card?.textContent || '').toLowerCase()
      if (!text) return
      const eventItem = events.find(item => includesText(text, item.title))
      const noteItem = notes.find(item => includesText(text, item.text?.slice(0, 40)))
      const treatmentItem = medications.find(item => includesText(text, item.name))
      const blockItem = availabilityBlocks.find(item => text.includes(formatAvailabilityBlockLabel(item).toLowerCase()) || includesText(text, item.note) || includesText(text, item.userName))
      const requestItem = requests.find(item => includesText(text, item.reason?.slice(0, 40)))
      const found = label.includes('evento') && eventItem ? { type: 'event' as const, item: eventItem }
        : treatmentItem ? { type: 'treatment' as const, item: treatmentItem }
        : noteItem ? { type: 'note' as const, item: noteItem }
        : blockItem ? { type: 'block' as const, item: blockItem }
        : requestItem ? { type: 'change' as const, item: requestItem }
        : eventItem ? { type: 'event' as const, item: eventItem }
        : null
      if (!found) return
      event.preventDefault()
      event.stopPropagation()
      openGuidedEditor(found)
    }
    document.addEventListener('click', captureEditClick, true)
    return () => document.removeEventListener('click', captureEditClick, true)
  }, [events, notes, medications, availabilityBlocks, requests, setSelectedChildId])

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
