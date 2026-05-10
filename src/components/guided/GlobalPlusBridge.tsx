'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { GuidedCreationPanel } from '@/components/guided/GuidedCreationPanelV9'

const GLOBAL_PLUS_STYLES = `
  button[aria-label="Abrir acciones rápidas del día"] { display: none !important; }
  .bottom-nav {
    align-items: stretch;
    overflow: visible !important;
    position: sticky;
    padding-top: 14px !important;
    min-height: 92px;
    border-radius: 30px !important;
    isolation: isolate;
  }
  .bottom-nav::before {
    content: '';
    position: absolute;
    left: 50%;
    top: -29px;
    width: 124px;
    height: 66px;
    transform: translateX(-50%);
    background: var(--bg-primary);
    border-radius: 0 0 72px 72px;
    box-shadow: inset 0 -1px 0 var(--border);
    z-index: 0;
    pointer-events: none;
  }
  .bottom-nav::after {
    content: '';
    position: absolute;
    left: 50%;
    top: -35px;
    width: 98px;
    height: 98px;
    transform: translateX(-50%);
    border-radius: 50%;
    background: var(--bg-nav);
    border: 1px solid var(--border);
    box-shadow: 0 18px 34px rgba(15, 23, 42, 0.12);
    z-index: 1;
    pointer-events: none;
  }
  .bottom-nav button.nav-btn { position: relative; z-index: 2; }
  .bottom-nav button.nav-btn:has(> span:first-child:not(.global-plus-orb)) { z-index: 2; }
  .bottom-nav button.nav-btn:has(span) {
    min-width: 0;
  }
  .bottom-nav button.nav-btn:nth-child(n) {
    flex-basis: 0;
  }
  .bottom-nav button.nav-btn span:only-child { pointer-events: none; }
  .bottom-nav button.nav-btn:has(span:nth-child(2)) { pointer-events: auto; }
  .bottom-nav button.nav-btn:has(span) { text-decoration: none; }
  .bottom-nav button.nav-btn img + span { white-space: nowrap; }
  .bottom-nav button.nav-btn:has(span:nth-child(1)) {}
  .bottom-nav button.nav-btn:has(span) {}
  .bottom-nav button.nav-btn:has(.global-plus-orb) {
    flex: 0 0 86px !important;
  }
  .bottom-nav button.nav-btn:has(img) {
    flex: 1 1 0 !important;
  }
  .bottom-nav button.nav-btn img[alt=""] + span { font-size: 10px; }
  .bottom-nav button.nav-btn:has(img[src*="events"]) { display: none !important; }
  .global-plus-nav-btn {
    order: 3 !important;
    color: #ffffff !important;
    transform: translateY(-24px);
    min-width: 86px;
    z-index: 4 !important;
    gap: 4px !important;
    padding-top: 0 !important;
    padding-bottom: 4px !important;
  }
  .global-plus-nav-btn:hover { transform: translateY(-27px); }
  .global-plus-nav-btn .global-plus-orb {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: radial-gradient(circle at 35% 24%, #7FB4FF 0%, #3B82F6 48%, #1D4ED8 100%);
    box-shadow: 0 22px 42px rgba(37, 99, 235, 0.34), inset 0 1px 0 rgba(255,255,255,0.38);
    border: 7px solid var(--bg-primary);
    font-size: 42px;
    font-weight: 900;
    line-height: 0.86;
    letter-spacing: -1px;
  }
  .global-plus-nav-btn .global-plus-label {
    margin-top: -5px;
    font-size: 11px;
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
  Más: 5,
}

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

function normalizeLabel(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()
}

function isDuplicatedCreateButton(button: HTMLButtonElement) {
  if (!button.closest('.app-main')) return false
  if (button.closest('.bottom-nav, .guided-creation-overlay, .guided-creation-card')) return false
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

function reorderBottomNav(nav: HTMLElement | null) {
  if (!nav) return
  const buttons = Array.from(nav.querySelectorAll<HTMLButtonElement>('button.nav-btn'))
  for (const button of buttons) {
    if (button.dataset.globalPlus === 'true') continue
    const label = Array.from(button.querySelectorAll('span'))
      .map(span => span.textContent?.trim())
      .find(Boolean) as TabLabel | undefined
    if (label === 'Eventos') {
      button.style.display = 'none'
      button.setAttribute('aria-hidden', 'true')
      button.tabIndex = -1
      continue
    }
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
      hideDuplicatedPageCreateButtons()
    }
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    reorderBottomNav(bottomNav)
    hideDuplicatedPageCreateButtons()
  }, [bottomNav, canCreate])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const closeOnNavigate = () => {
      setOpen(false)
      window.setTimeout(hideDuplicatedPageCreateButtons, 0)
    }
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
