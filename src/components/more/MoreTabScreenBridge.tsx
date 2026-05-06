'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'

type MoreTarget = 'events' | 'documents' | 'packing' | 'contacts' | 'medications' | 'stats' | 'settings'
type MoreCard = { id: MoreTarget; title: string; subtitle: string; icon: string; tone: string }
type ScreenBounds = { top: number; bottom: number; left: number; width: number }

const MORE_CARDS_PARENT: MoreCard[] = [
  { id: 'documents', title: 'Documentos', subtitle: 'Archivos seguros y privados', icon: '/nav-icons/notes.svg', tone: '#3B82F6' },
  { id: 'medications', title: 'Medicación', subtitle: 'Tratamientos y tomas', icon: '/shell-icons/medication.svg', tone: '#EC4899' },
  { id: 'contacts', title: 'Contactos', subtitle: 'Personas y datos útiles', icon: '/shell-icons/contacts.svg', tone: '#10B981' },
  { id: 'packing', title: 'Equipaje', subtitle: 'Ropa y objetos importantes', icon: '/shell-icons/packing.svg', tone: '#F59E0B' },
  { id: 'stats', title: 'Estadísticas', subtitle: 'Resumen y evolución', icon: '/shell-icons/stats.svg', tone: '#8B5CF6' },
  { id: 'settings', title: 'Ajustes', subtitle: 'Familia, permisos y configuración', icon: '/shell-icons/settings.svg', tone: '#64748B' },
]

const MORE_CARDS_COLLABORATOR: MoreCard[] = [
  { id: 'contacts', title: 'Contactos', subtitle: 'Personas y datos útiles', icon: '/shell-icons/contacts.svg', tone: '#10B981' },
  { id: 'medications', title: 'Medicación', subtitle: 'Tratamientos y tomas', icon: '/shell-icons/medication.svg', tone: '#EC4899' },
  { id: 'settings', title: 'Ajustes', subtitle: 'Cuenta y configuración', icon: '/shell-icons/settings.svg', tone: '#64748B' },
]

const MORE_CARDS_BASIC: MoreCard[] = [
  { id: 'settings', title: 'Ajustes', subtitle: 'Cuenta y configuración', icon: '/shell-icons/settings.svg', tone: '#64748B' },
]

function isMoreNavButton(target: EventTarget | null) {
  if (!(target instanceof Element)) return false
  const button = target.closest('button')
  if (!button || !button.closest('.bottom-nav')) return false
  const text = (button.textContent || '').trim().toLowerCase()
  return text === 'más' || !!button.querySelector('img[src*="/nav-icons/more.svg"]')
}

function isAnyBottomNavButton(target: EventTarget | null) {
  return target instanceof Element && !!target.closest('.bottom-nav button')
}

function readBounds(): ScreenBounds {
  const header = document.querySelector<HTMLElement>('.app-header')
  const nav = document.querySelector<HTMLElement>('.bottom-nav')
  const shell = document.querySelector<HTMLElement>('.app-shell')
  const shellRect = shell?.getBoundingClientRect()
  const headerBottom = Math.max(0, header?.getBoundingClientRect().bottom ?? 0)
  const navTop = nav?.getBoundingClientRect().top ?? window.innerHeight
  return {
    top: headerBottom + 4,
    bottom: Math.max(88, window.innerHeight - navTop + 8),
    left: shellRect?.left ?? 0,
    width: shellRect?.width ?? window.innerWidth,
  }
}

export function MoreTabScreenBridge() {
  const { user } = useAuth()
  const { children, selectedChildId } = useAppStore()
  const [open, setOpen] = useState(false)
  const [bounds, setBounds] = useState<ScreenBounds | null>(null)

  const child = useMemo(() => children.find(item => item.id === selectedChildId) ?? null, [children, selectedChildId])
  const isParentForSelectedChild = !!child && !!user?.uid && child.parents.includes(user.uid)
  const isCollaboratorForSelectedChild = !!child && !!user?.uid && !!child.collaborators?.includes(user.uid)
  const cards = isParentForSelectedChild ? MORE_CARDS_PARENT : isCollaboratorForSelectedChild ? MORE_CARDS_COLLABORATOR : MORE_CARDS_BASIC

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.body.classList.toggle('custodia-more-screen-open', open)
    return () => document.body.classList.remove('custodia-more-screen-open')
  }, [open])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const update = () => setBounds(readBounds())
    update()
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const closeOnNavigate = () => setOpen(false)
    window.addEventListener('custodia:navigate', closeOnNavigate)
    return () => window.removeEventListener('custodia:navigate', closeOnNavigate)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = (event: MouseEvent) => {
      if (isMoreNavButton(event.target)) {
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()
        setBounds(readBounds())
        setOpen(current => !current)
        return
      }

      if (open && isAnyBottomNavButton(event.target)) setOpen(false)
    }
    window.addEventListener('click', handler, { capture: true })
    return () => window.removeEventListener('click', handler, { capture: true } as any)
  }, [open])

  const navigateTo = (target: MoreTarget) => {
    setOpen(false)
    window.dispatchEvent(new CustomEvent('custodia:navigate', { detail: { tab: target, childId: child?.id } }))
  }

  if (!open || !bounds) return null

  return (
    <section
      className="more-tab-screen"
      aria-label="Más funciones"
      style={{
        '--more-screen-top': `${bounds.top}px`,
        '--more-screen-bottom': `${bounds.bottom}px`,
        '--more-screen-left': `${bounds.left}px`,
        '--more-screen-width': `${bounds.width}px`,
      } as CSSProperties}
    >
      <div className="more-tab-screen-inner">
        <div className="more-real-grid more-tab-screen-grid">
          {cards.map(card => (
            <button key={card.id} type="button" className="more-real-card" style={{ '--more-tone': card.tone } as CSSProperties} onClick={() => navigateTo(card.id)}>
              <span className="more-real-card-copy">
                <span className="more-real-card-title">{card.title}</span>
                <span className="more-real-card-subtitle">{card.subtitle}</span>
              </span>
              <span className="more-real-icon-wrap"><img src={card.icon} alt="" aria-hidden="true" /></span>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
