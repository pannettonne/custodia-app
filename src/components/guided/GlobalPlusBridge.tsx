'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { GuidedCreationPanel } from '@/components/guided/GuidedCreationPanelV9'

const GLOBAL_PLUS_STYLES = `
  button[aria-label="Abrir acciones rápidas del día"] { display: none !important; }

  .bottom-nav {
    position: sticky !important;
    bottom: calc(env(safe-area-inset-bottom) + 10px) !important;
    margin: 0 14px 12px !important;
    min-height: 78px !important;
    padding: 10px 12px 12px !important;
    overflow: visible !important;
    isolation: isolate !important;
    align-items: center !important;
    gap: 4px !important;
    border-radius: 30px !important;
    border: 1px solid var(--border-hover) !important;
    background: var(--bg-nav) !important;
    box-shadow: 0 24px 54px rgba(15, 23, 42, 0.18) !important;
  }

  .bottom-nav::before {
    content: '';
    position: absolute;
    left: 50%;
    top: -31px;
    width: 112px;
    height: 74px;
    transform: translateX(-50%);
    border-radius: 64px 64px 26px 26px;
    background: var(--bg-nav);
    border: 1px solid var(--border-hover);
    border-bottom: 0;
    box-shadow: 0 -10px 28px rgba(15, 23, 42, 0.07);
    z-index: 0;
    pointer-events: none;
  }

  .bottom-nav::after {
    content: '';
    position: absolute;
    left: 50%;
    top: -18px;
    width: 74px;
    height: 74px;
    transform: translateX(-50%);
    border-radius: 999px;
    background: linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 86%, #fff 14%), var(--bg-nav));
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.54);
    z-index: 1;
    pointer-events: none;
  }

  .bottom-nav button.nav-btn:has(img[src*="events"]) { display: none !important; }

  .bottom-nav .nav-btn:not(.global-plus-nav-btn) {
    flex: 1 1 0 !important;
    min-width: 0 !important;
    min-height: 56px !important;
    padding: 8px 3px 7px !important;
    border-radius: 18px !important;
    background: transparent !important;
    box-shadow: none !important;
    color: var(--text-muted) !important;
    position: relative !important;
    z-index: 2 !important;
  }

  .bottom-nav .nav-btn:not(.global-plus-nav-btn).active {
    background: transparent !important;
    box-shadow: none !important;
    color: var(--blue) !important;
  }

  .bottom-nav .nav-btn:not(.global-plus-nav-btn).active img {
    transform: translateY(-1px) scale(1.04) !important;
    opacity: 1 !important;
  }

  .bottom-nav .nav-btn:not(.global-plus-nav-btn) img {
    width: 22px !important;
    height: 22px !important;
    opacity: 0.76 !important;
  }

  .bottom-nav .nav-btn:not(.global-plus-nav-btn) span:not(.nav-badge):not(.nav-active-line) {
    font-size: 10px !important;
    font-weight: 900 !important;
    letter-spacing: -0.2px !important;
    white-space: nowrap !important;
  }

  .bottom-nav .nav-active-line {
    bottom: 1px !important;
    width: 24px !important;
    height: 4px !important;
    border-radius: 999px !important;
    background: var(--blue) !important;
    box-shadow: 0 0 12px color-mix(in srgb, var(--blue) 42%, transparent) !important;
  }

  .global-plus-nav-btn {
    order: 3 !important;
    flex: 0 0 92px !important;
    min-width: 92px !important;
    min-height: 94px !important;
    padding: 0 0 4px !important;
    transform: translateY(-27px) !important;
    background: transparent !important;
    box-shadow: none !important;
    color: #fff !important;
    gap: 3px !important;
    z-index: 4 !important;
  }

  .global-plus-nav-btn:hover { transform: translateY(-29px) !important; }

  .global-plus-nav-btn .global-plus-orb {
    width: 66px;
    height: 66px;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: radial-gradient(circle at 34% 22%, #8EC5FF 0%, #3B82F6 48%, #1D4ED8 100%);
    border: 6px solid var(--bg-nav);
    box-shadow:
      0 18px 34px rgba(37, 99, 235, 0.34),
      0 6px 16px rgba(15, 23, 42, 0.12),
      inset 0 1px 0 rgba(255, 255, 255, 0.42);
    font-size: 39px;
    font-weight: 950;
    line-height: 0.82;
    letter-spacing: -1px;
  }

  .global-plus-nav-btn .global-plus-label {
    margin-top: -4px;
    font-size: 11px;
    font-weight: 950;
    color: var(--blue);
    letter-spacing: -0.2px;
  }

  @media (max-width: 390px) {
    .bottom-nav {
      margin-inline: 10px !important;
      padding-inline: 9px !important;
      gap: 2px !important;
    }
    .global-plus-nav-btn {
      flex-basis: 84px !important;
      min-width: 84px !important;
    }
    .global-plus-nav-btn .global-plus-orb {
      width: 62px;
      height: 62px;
      font-size: 36px;
    }
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
