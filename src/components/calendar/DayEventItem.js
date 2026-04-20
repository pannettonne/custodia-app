'use client'
import { useMemo, useState } from 'react'

function buildNavigationLinks(event) {
  const hasCoords = typeof event?.locationLatitude === 'number' && typeof event?.locationLongitude === 'number'
  const encodedDestination = encodeURIComponent(event?.locationAddress || event?.locationName || '')

  return {
    googleMaps: hasCoords
      ? `https://www.google.com/maps/search/?api=1&query=${event.locationLatitude},${event.locationLongitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodedDestination}`,
    waze: hasCoords
      ? `https://waze.com/ul?ll=${event.locationLatitude},${event.locationLongitude}&navigate=yes`
      : `https://waze.com/ul?q=${encodedDestination}&navigate=yes`,
    appleMaps: hasCoords
      ? `https://maps.apple.com/?ll=${event.locationLatitude},${event.locationLongitude}`
      : `https://maps.apple.com/?q=${encodedDestination}`,
  }
}

export function DayEventItem({
  event,
  cancelled,
  canManageOccurrence,
  eventActionLoading,
  onNavigate,
  onToggleOccurrence,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const hasLocation = !!(event.locationName || event.locationAddress)
  const navLinks = useMemo(() => buildNavigationLinks(event), [event])
  const addressLine = event.locationAddress || event.locationName || ''

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        boxSizing: 'border-box',
        overflow: 'visible',
        zIndex: menuOpen ? 40 : 1,
        padding: '10px 12px',
        borderRadius: 14,
        background: cancelled ? 'rgba(239,68,68,0.10)' : 'rgba(16,185,129,0.10)',
        border: cancelled ? '1px solid rgba(239,68,68,0.25)' : '1px solid rgba(16,185,129,0.2)',
        opacity: cancelled ? 0.9 : 1,
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          alignItems: 'start',
          gap: 10,
          width: '100%',
          minWidth: 0,
        }}
      >
        <button
          type="button"
          onClick={onNavigate}
          style={{
            width: '100%',
            minWidth: 0,
            background: 'transparent',
            border: 'none',
            padding: 0,
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              fontSize: 13,
              color: 'var(--text-strong)',
              fontWeight: 800,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {event.title}
          </div>

          <div
            style={{
              fontSize: 11,
              color: 'var(--text-secondary)',
              marginTop: 4,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {event.allDay ? 'Todo el día' : (event.time || 'Sin hora')} · {event.customCategory || event.category}
          </div>

          {addressLine && (
            <div
              style={{
                fontSize: 10,
                color: 'var(--text-muted)',
                marginTop: 4,
                lineHeight: 1.35,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                wordBreak: 'break-word',
              }}
            >
              {addressLine}
            </div>
          )}
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
          {hasLocation && (
            <div style={{ position: 'relative', zIndex: 50 }}>
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation()
                  setMenuOpen(v => !v)
                }}
                title="Abrir navegación"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 12,
                  border: '1px solid rgba(239,68,68,0.22)',
                  background: 'rgba(239,68,68,0.10)',
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: 17,
                }}
              >
                📍
              </button>

              {menuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    minWidth: 156,
                    padding: 8,
                    borderRadius: 14,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-card)',
                    boxShadow: '0 14px 30px rgba(15,23,42,0.16)',
                    zIndex: 999,
                    display: 'grid',
                    gap: 6,
                  }}
                >
                  <a href={navLinks.googleMaps} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', fontSize: 12, fontWeight: 800, color: '#3b82f6', padding: '8px 10px', borderRadius: 10, background: 'rgba(59,130,246,0.10)' }}>Google Maps</a>
                  <a href={navLinks.waze} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', fontSize: 12, fontWeight: 800, color: '#10b981', padding: '8px 10px', borderRadius: 10, background: 'rgba(16,185,129,0.10)' }}>Waze</a>
                  <a href={navLinks.appleMaps} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', fontSize: 12, fontWeight: 800, color: '#8b5cf6', padding: '8px 10px', borderRadius: 10, background: 'rgba(139,92,246,0.10)' }}>Apple Maps</a>
                </div>
              )}
            </div>
          )}

          {canManageOccurrence && (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation()
                onToggleOccurrence()
              }}
              disabled={eventActionLoading === event.id}
              style={{
                background: 'none',
                border: 'none',
                color: cancelled ? '#10b981' : '#f87171',
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
                flexShrink: 0,
                padding: 0,
              }}
            >
              {eventActionLoading === event.id ? '...' : cancelled ? 'Restaurar' : 'Cancelar'}
            </button>
          )}
        </div>
      </div>

      {cancelled && <div style={{ fontSize: 11, color: '#f87171', marginTop: 6, fontWeight: 800 }}>Cancelado</div>}
      {event.notes && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>{event.notes}</div>}
    </div>
  )
}
