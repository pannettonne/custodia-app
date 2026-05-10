'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { GuidedCreationPanel } from '@/components/guided/GuidedCreationPanelV9'

const DUPLICATED_CREATE_LABELS = [
  'evento',
  'nueva nota',
  'nota',
  'cambio',
  'asignacion',
  'asignación',
  'medicacion',
  'medicación',
  'tratamiento',
  'documento',
]

function normalizeLabel(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()
}

function isDuplicatedCreateButton(button: HTMLButtonElement) {
  if (!button.closest('.app-main')) return false
  if (button.closest('.bottom-nav-shell, .guided-creation-overlay, .guided-creation-card')) return false
  const label = normalizeLabel(button.textContent || button.getAttribute('aria-label') || button.getAttribute('title') || '')
  if (!label.startsWith('+')) return false
  return DUPLICATED_CREATE_LABELS.some(item => label.includes(item))
}

function hideDuplicatedPageCreateButtons() {
  if (typeof document === 'undefined') return
  for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>('.app-main button'))) {
    if (!isDuplicatedCreateButton(button)) continue
    button.dataset.hiddenByGlobalPlus = 'true'
    button.style.display = 'none'
    button.setAttribute('aria-hidden', 'true')
    button.tabIndex = -1
  }
}

export function GlobalPlusBridge() {
  const { user } = useAuth()
  const { children, selectedChildId } = useAppStore()
  const [open, setOpen] = useState(false)

  const child = useMemo(() => children.find(item => item.id === selectedChildId) ?? null, [children, selectedChildId])
  const canCreate = !!child && !!user?.uid && child.parents.includes(user.uid)

  useEffect(() => {
    hideDuplicatedPageCreateButtons()
    const observer = new MutationObserver(hideDuplicatedPageCreateButtons)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    hideDuplicatedPageCreateButtons()
  }, [canCreate])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const openGuidedCreate = () => {
      if (canCreate) setOpen(true)
    }
    const closeOnNavigate = () => {
      setOpen(false)
      window.setTimeout(hideDuplicatedPageCreateButtons, 0)
    }
    window.addEventListener('custodia:open-guided-create', openGuidedCreate)
    window.addEventListener('custodia:navigate', closeOnNavigate)
    return () => {
      window.removeEventListener('custodia:open-guided-create', openGuidedCreate)
      window.removeEventListener('custodia:navigate', closeOnNavigate)
    }
  }, [canCreate])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="guided-creation-overlay" role="dialog" aria-modal="true" aria-label="Creación guiada">
      <div className="guided-creation-shell">
        <div className="guided-creation-topbar">
          <button type="button" className="guided-creation-back" onClick={() => setOpen(false)}>Cerrar</button>
          <button type="button" className="guided-creation-close" aria-label="Cerrar creación guiada" onClick={() => setOpen(false)}>×</button>
        </div>
        <GuidedCreationPanel onDone={() => setOpen(false)} />
      </div>
    </div>,
    document.body
  )
}
