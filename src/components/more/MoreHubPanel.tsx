'use client'

import type { CSSProperties } from 'react'

type MoreTarget = 'events' | 'documents' | 'packing' | 'contacts' | 'medications' | 'stats' | 'settings'

type MoreCard = {
  id: MoreTarget
  title: string
  subtitle: string
  icon: string
  tone: string
}

const PARENT_CARDS: MoreCard[] = [
  { id: 'events', title: 'Eventos', subtitle: 'Citas, colegio y actividades', icon: '/nav-icons/events.svg', tone: '#10B981' },
  { id: 'documents', title: 'Documentos', subtitle: 'Archivos seguros y privados', icon: '/nav-icons/notes.svg', tone: '#3B82F6' },
  { id: 'medications', title: 'Medicación', subtitle: 'Tratamientos y tomas', icon: '/shell-icons/medication.svg', tone: '#EC4899' },
  { id: 'contacts', title: 'Contactos', subtitle: 'Personas y datos útiles', icon: '/shell-icons/contacts.svg', tone: '#10B981' },
  { id: 'packing', title: 'Equipaje', subtitle: 'Ropa y objetos importantes', icon: '/shell-icons/packing.svg', tone: '#F59E0B' },
  { id: 'stats', title: 'Estadísticas', subtitle: 'Resumen y evolución', icon: '/shell-icons/stats.svg', tone: '#8B5CF6' },
  { id: 'settings', title: 'Ajustes', subtitle: 'Familia, permisos y configuración', icon: '/shell-icons/settings.svg', tone: '#64748B' },
]

const COLLABORATOR_CARDS: MoreCard[] = [
  { id: 'contacts', title: 'Contactos', subtitle: 'Personas y datos útiles', icon: '/shell-icons/contacts.svg', tone: '#10B981' },
  { id: 'medications', title: 'Medicación', subtitle: 'Tratamientos y tomas', icon: '/shell-icons/medication.svg', tone: '#EC4899' },
  { id: 'settings', title: 'Ajustes', subtitle: 'Cuenta y configuración', icon: '/shell-icons/settings.svg', tone: '#64748B' },
]

const BASIC_CARDS: MoreCard[] = [
  { id: 'settings', title: 'Ajustes', subtitle: 'Cuenta y configuración', icon: '/shell-icons/settings.svg', tone: '#64748B' },
]

export function MoreHubPanel({
  mode,
  onNavigate,
}: {
  mode: 'parent' | 'collaborator' | 'basic'
  onNavigate: (target: MoreTarget) => void
}) {
  const cards = mode === 'parent' ? PARENT_CARDS : mode === 'collaborator' ? COLLABORATOR_CARDS : BASIC_CARDS

  return (
    <section aria-label="Más funciones" className="more-real-screen">
      <div className="more-real-shell">
        <div className="more-real-hero">
          <div>
            <div className="more-real-kicker">CustodiaApp</div>
            <h1 className="more-real-title">Más funciones</h1>
            <p className="more-real-subtitle">Herramientas para organizar, cuidar y coordinar.</p>
          </div>
        </div>

        <div className="more-real-grid">
          {cards.map(card => (
            <button
              key={card.id}
              type="button"
              className="more-real-card"
              style={{ '--more-tone': card.tone } as CSSProperties}
              onClick={() => onNavigate(card.id)}
            >
              <span className="more-real-card-copy">
                <span className="more-real-card-title">{card.title}</span>
                <span className="more-real-card-subtitle">{card.subtitle}</span>
              </span>
              <span className="more-real-icon-wrap">
                <img src={card.icon} alt="" aria-hidden="true" />
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
