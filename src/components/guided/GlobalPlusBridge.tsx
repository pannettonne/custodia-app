'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { GuidedCreationPanel } from '@/components/guided/GuidedCreationPanelV9'

const GLOBAL_PLUS_STYLES = `
  button[aria-label="Abrir acciones rápidas del día"] { display: none !important; }
  .bottom-nav button.nav-btn:has(img[src*="events"]) { display: none !important; }

  .bottom-nav {
    position: sticky !important;
    bottom: calc(env(safe-area-inset-bottom) + 10px) !important;
    margin: 0 14px 12px !important;
    min-height: 78px !important;
    padding: 8px 12px 12px !important;
    overflow: visible !important;
    isolation: isolate !important;
    align-items: center !important;
    gap: 2px !important;
    border-radius: 30px !important;
    border: 1px solid var(--border-hover) !important;
    background: var(--bg-nav) !important;
    box-shadow: 0 22px 48px rgba(15, 23, 42, 0.18) !important;
  }

  .bottom-nav::before {
    content: '';
    position: absolute;
    left: 50%;
    top: -27px;
    width: 104px;
    height: 64px;
    transform: translateX(-50%);
    border-radius: 60px 60px 22px 22px;
    background: var(--bg-nav);
    border: 1px solid var(--border-hover);
    border-bottom: 0;
    z-index: 0;
    pointer-events: none;
  }

  .bottom-nav::after {
    content: '';
    position: absolute;
    left: 50%;
    top: -14px;
    width: 70px;
    height: 70px;
    transform: translateX(-50%);
    border-radius: 999px;
    background: var(--bg-nav);
    z-index: 1;
    pointer-events: none;
  }

  .bottom-nav .nav-btn:not(.nav-create-btn) {
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

  .bottom-nav .nav-btn:not(.nav-create-btn).active {
    background: transparent !important;
    box-shadow: none !important;
    color: var(--blue) !important;
  }

  .bottom-nav .nav-btn:not(.nav-create-btn).active img {
    transform: translateY(-1px) scale(1.04) !important;
    opacity: 1 !important;
  }

  .bottom-nav .nav-btn:not(.nav-create-btn) img {
    width: 22px !important;
    height: 22px !important;
    opacity: 0.76 !important;
  }

  .bottom-nav .nav-btn:not(.nav-create-btn) span:not(.nav-badge):not(.nav-active-line) {
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

  .nav-create-btn {
    order: 3 !important;
    flex: 0 0 88px !important;
    min-width: 88px !important;
    min-height: 92px !important;
    padding: 0 0 4px !important;
    transform: translateY(-25px) !important;
    background: transparent !important;
    box-shadow: none !important;
    color: #fff !important;
    gap: 3px !important;
    z-index: 4 !important;
    display: flex !important;
  }

  .nav-create-btn:active { transform: translateY(-22px) scale(0.98) !important; }

  .nav-create-orb {
    width: 64px;
    height: 64px;
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
    font-size: 38px;
    font-weight: 950;
    line-height: 0.82;
    letter-spacing: -1px;
  }

  .nav-create-label {
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
    }
    .nav-create-btn {
      flex-basis: 82px !important;
      min-width: 82px !important;
    }
    .nav-create-orb {
      width: 60px;
      height: 60px;
      font-size: 35px;
    }
  }
`

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

function configureBottomNav(canCreate: boolean) {
  if (typeof document === 'undefined') return
  const nav = document.querySelector<HTMLElement>('.bottom-nav')
  if (!nav) return

  const labels = Array.from(nav.querySelectorAll<HTMLButtonElement>('button.nav-btn'))
  for (const button of labels) {
    if (button.classList.contains('nav-create-btn')) continue
    const text = normalizeLabel(button.textContent || '')
    if (text.includes('eventos')) {
      button.style.display = 'none'
      button.setAttribute('aria-hidden', 'true')
      button.tabIndex = -1
      continue
    }
    if (text.includes('hoy')) button.style.order = '1'
    if (text.includes('calendario')) button.style.order = '2'
    if (text.includes('cambios')) button.style.order = '4'
    if (text.includes('mas')) button.style.order = '5'
  }

  const existing = nav.querySelector<HTMLButtonElement>('.nav-create-btn')
  if (!canCreate) {
    existing?.remove()
    return
  }
  if (existing) return

  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'nav-btn nav-create-btn'
  button.setAttribute('aria-label', 'Crear')
  button.title = 'Crear'
  button.innerHTML = '<span class="nav-create-orb" aria-hidden="true">+</span><span class="nav-create-label">Crear</span>'
  button.addEventListener('click', event => {
    event.preventDefault()
    event.stopPropagation()
    window.dispatchEvent(new CustomEvent('custodia:open-guided-create'))
  })
  nav.appendChild(button)
}

export function GlobalPlusBridge() {
  const { user } = useAuth()
  const { children, selectedChildId } = useAppStore()
  const [open, setOpen] = useState(false)

  const child = useMemo(() => children.find(item => item.id === selectedChildId) ?? null, [children, selectedChildId])
  const canCreate = !!child && !!user?.uid && child.parents.includes(user.uid)

  useEffect(() => {
    installGlobalPlusStyles()
    hideDuplicatedPageCreateButtons()
    configureBottomNav(canCreate)
    const sync = () => {
      hideDuplicatedPageCreateButtons()
      configureBottomNav(canCreate)
    }
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [canCreate])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const openGuidedCreate = () => {
      if (canCreate) setOpen(true)
    }
    const closeOnNavigate = () => {
      setOpen(false)
      window.setTimeout(() => {
        hideDuplicatedPageCreateButtons()
        configureBottomNav(canCreate)
      }, 0)
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
