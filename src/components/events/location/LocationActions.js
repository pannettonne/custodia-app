'use client'
import { useState } from 'react'

export function LocationActions({ event, navLinks }) {
  const [open, setOpen] = useState(false)
  if (!event.locationName && !event.locationAddress) return null

  return (
    <div style={{ marginBottom: 8 }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '10px 12px',
          borderRadius: 12,
          border: '1px solid var(--border)',
          background: 'var(--bg-soft)',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 16 }}>📍</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-strong)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {event.locationName || event.locationAddress}
          </div>
          {event.locationAddress && event.locationName && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {event.locationAddress}
            </div>
          )}
        </div>
        <span style={{ fontSize: 11, fontWeight: 800, color: '#10b981' }}>Llévame</span>
      </button>

      {open && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <a href={navLinks.googleMaps} target="_blank" rel="noreferrer" style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.24)', borderRadius: 10, color: '#93c5fd', fontSize: 11, fontWeight: 800, padding: '7px 10px', textDecoration: 'none' }}>Google Maps</a>
          <a href={navLinks.waze} target="_blank" rel="noreferrer" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.24)', borderRadius: 10, color: '#6ee7b7', fontSize: 11, fontWeight: 800, padding: '7px 10px', textDecoration: 'none' }}>Waze</a>
          <a href={navLinks.appleMaps} target="_blank" rel="noreferrer" style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.24)', borderRadius: 10, color: '#c4b5fd', fontSize: 11, fontWeight: 800, padding: '7px 10px', textDecoration: 'none' }}>Apple Maps</a>
        </div>
      )}
    </div>
  )
}
