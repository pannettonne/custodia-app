'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { GuidedCreationPanel } from '@/components/guided/GuidedCreationPanelV9'

const GLOBAL_PLUS_STYLES = `
  .guided-creation-card { display: none !important; }
  button[aria-label="Abrir acciones rápidas del día"] { display: none !important; }
  .bottom-nav { align-items: stretch; }
  .global-plus-nav-btn {
    order: 3 !important;
    color: #ffffff !important;
    transform: translateY(-13px);
    min-width: 66px;
    z-index: 3;
  }
  .global-plus-nav-btn:hover { transform: translateY(-15px); }
  .global-plus-nav-btn .global-plus-orb {
    width: 54px;
    height: 54px;
    border-radius: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(180deg, #3B82F6 0%, #2563EB 100%);
    box-shadow: 0 16px 28px rgba(37, 99, 235, 0.30);
    border: 4px solid var(--bg-nav);
    font-size: 32px;
    font-weight: 900;
    line-height: 1;
  }
  .global-plus-nav-btn .global-plus-label {
    margin-top: -1px;
    font-size: 10px;
    font-weight: 900;
    color: var(--blue);
  }
`

type TabLabel = 'Hoy' | 'Calendario' | 'Cambios' | 'Eventos' | 'Más'

const NAV_ORDER: Record<TabLabel, number> = {
  Hoy: 1,
  Calendario: 2,
  Cambios: 4,
  Eventos: 5,
  Más: 6,
}

function findBottomNav() {
  if (typeof document === 'undefined') return null
  return document.querySelector<HTMLElement>('.bottom-nav')
}

function installGlobalPlusStyles() {
  if (typeof document === 'undefined') return
  const id = 'custodia-global-plus-styles'
  let style = document.getElementById(id) as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = id
    document.head.appendChild(style)
  }
  style.textContent = GLOBAL_PLUS_STYLES
}

function reorderBottomNav(nav: HTMLElement | null) {
  if (!nav) return
  const buttons = Array.from(nav.querySelectorAll<HTMLButtonElement>('button.nav-btn'))
  for (const button of buttons) {
    if (button.dataset.globalPlus === 'true') continue
    const label = Array.from(button.querySelectorAll('span'))
      .map(span => span.textContent?.trim())
      .find(Boolean) as TabLabel | undefined
    if (label && NAV_ORDER[label]) button.style.order = String(NAV_ORDER[label])
  }
}

export function GlobalPlusBridge() {
  const { user } = useAuth()
  const { children, selectedChildId } = useAppStore()
  const [bottomNav, setBottomNav] = useState<HTMLElement | null>(null)
  const [open, setOpen] = useState(false)

  const child = useMemo(() => children.find(item => item.id === selectedChildId) ?? null, [children, selectedChildId])
  const canCreate = !!child && !!user?.uid && child.parents.includes(user.uid)

  useEffect(() => {
    installGlobalPlusStyles()
    const sync = () => {
      const nav = findBottomNav()
      setBottomNav(nav)
      reorderBottomNav(nav)
    }
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    reorderBottomNav(bottomNav)
  }, [bottomNav, canCreate])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const closeOnNavigate = () => setOpen(false)
    window.addEventListener('custodia:navigate', closeOnNavigate)
    return () => window.removeEventListener('custodia:navigate', closeOnNavigate)
  }, [])

  if (!canCreate || !bottomNav || typeof document === 'undefined') return null

  return (
    <>
      {createPortal(
        <button
          type="button"
          className="nav-btn global-plus-nav-btn"
          data-global-plus="true"
          aria-label="Crear"
          title="Crear"
          style={{ order: 3 } as CSSProperties}
          onClick={() => setOpen(true)}
        >
          <span className="global-plus-orb" aria-hidden="true">+</span>
          <span className="global-plus-label">Crear</span>
        </button>,
        bottomNav
      )}

      {open && createPortal(
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
      )}
    </>
  )
}
