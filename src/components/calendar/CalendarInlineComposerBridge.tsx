'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { EventForm } from '@/components/events/location/EventForm'
import { CalendarInlineNoteForm } from '@/components/calendar/CalendarInlineNoteForm'

type InlineComposer = { type: 'event' | 'note'; date: string; seq: number } | null
type MoreTarget = 'events' | 'documents' | 'packing' | 'contacts' | 'medications' | 'stats' | 'settings'
type MoreCard = { id: MoreTarget; title: string; subtitle: string; icon: string; tone: string }

const MORE_CARDS_PARENT: MoreCard[] = [
  { id: 'events', title: 'Eventos', subtitle: 'Citas, colegio y actividades', icon: '/nav-icons/events.svg', tone: '#10B981' },
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
  if (!button) return false
  const text = (button.textContent || '').trim().toLowerCase()
  const hasMoreIcon = !!button.querySelector('img[src*="/nav-icons/more.svg"]')
  return hasMoreIcon || text === 'más'
}

export function CalendarInlineComposerBridge() {
  const { user } = useAuth()
  const { children, selectedChildId } = useAppStore()
  const [inlineComposer, setInlineComposer] = useState<InlineComposer>(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const [mainElement, setMainElement] = useState<HTMLElement | null>(null)

  const child = useMemo(() => children.find(item => item.id === selectedChildId) ?? null, [children, selectedChildId])
  const isParentForSelectedChild = !!child && !!user?.uid && child.parents.includes(user.uid)
  const isCollaboratorForSelectedChild = !!child && !!user?.uid && !!child.collaborators?.includes(user.uid)
  const moreCards = isParentForSelectedChild ? MORE_CARDS_PARENT : isCollaboratorForSelectedChild ? MORE_CARDS_COLLABORATOR : MORE_CARDS_BASIC

  useEffect(() => {
    if (typeof document === 'undefined') return
    setMainElement(document.querySelector<HTMLElement>('.app-main'))
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.body.classList.toggle('custodia-more-open', moreOpen)
    return () => document.body.classList.remove('custodia-more-open')
  }, [moreOpen])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<any>).detail
      if ((detail?.openComposer !== 'event' && detail?.openComposer !== 'note') || !detail?.date) return
      event.preventDefault()
      setMoreOpen(false)
      setInlineComposer({ type: detail.openComposer, date: detail.date, seq: Date.now() })
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('custodia:navigate', { detail: { tab: 'calendar', childId: detail.childId, date: detail.date } }))
      }, 0)
    }
    window.addEventListener('custodia:navigate', handler, { capture: true })
    return () => window.removeEventListener('custodia:navigate', handler, { capture: true } as any)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = (event: MouseEvent) => {
      if (!isMoreNavButton(event.target)) return
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      setInlineComposer(null)
      setMoreOpen(current => !current)
    }
    window.addEventListener('click', handler, { capture: true })
    return () => window.removeEventListener('click', handler, { capture: true } as any)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMoreOpen(false)
        setInlineComposer(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const navigateFromMore = (target: MoreTarget) => {
    setMoreOpen(false)
    window.dispatchEvent(new CustomEvent('custodia:navigate', { detail: { tab: target, childId: child?.id } }))
  }

  return (
    <>
      {moreOpen && mainElement ? createPortal(<MoreHubScreen cards={moreCards} onClose={() => setMoreOpen(false)} onNavigate={navigateFromMore} />, mainElement) : null}
      {inlineComposer ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'var(--bg-primary)',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            padding: 'calc(env(safe-area-inset-top) + 18px) 14px calc(env(safe-area-inset-bottom) + 112px)',
          }}
          onClick={() => setInlineComposer(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 560,
              margin: '0 auto',
              minHeight: 'calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 130px)',
              display: 'flex',
              alignItems: 'flex-start',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: '100%' }}>
              {inlineComposer.type === 'event'
                ? <EventForm key={inlineComposer.seq} event={null} initialDate={inlineComposer.date} onClose={() => setInlineComposer(null)} />
                : <CalendarInlineNoteForm key={inlineComposer.seq} date={inlineComposer.date} onClose={() => setInlineComposer(null)} />}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

function MoreHubScreen({ cards, onClose, onNavigate }: { cards: MoreCard[]; onClose: () => void; onNavigate: (target: MoreTarget) => void }) {
  return (
    <section aria-label="Más funciones" className="more-real-screen">
      <div className="more-real-shell">
        <div className="more-real-hero">
          <div>
            <div className="more-real-kicker">CustodiaApp</div>
            <h1 className="more-real-title">Más funciones</h1>
            <p className="more-real-subtitle">Herramientas para organizar, cuidar y coordinar.</p>
          </div>
          <button type="button" className="more-real-close" aria-label="Cerrar Más" onClick={onClose}>×</button>
        </div>

        <div className="more-real-grid">
          {cards.map(card => (
            <button key={card.id} type="button" className="more-real-card" style={{ '--more-tone': card.tone } as CSSProperties} onClick={() => onNavigate(card.id)}>
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
