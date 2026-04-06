'use client'
import { useState, useMemo } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { createEvent, deleteEvent } from '@/lib/db'
import { formatDate } from '@/lib/utils'
import type { SchoolEvent, EventCategory } from '@/types'

const CAT_CONFIG: Record<EventCategory, { label: string; icon: string; color: string }> = {
  reunion:      { label: 'Reunión',       icon: '👥', color: '#3b82f6' },
  excursion:    { label: 'Excursión',     icon: '🚌', color: '#10b981' },
  examen:       { label: 'Examen',        icon: '📝', color: '#f59e0b' },
  extraescolar: { label: 'Extraescolar',  icon: '⚽', color: '#8b5cf6' },
  festivo:      { label: 'Festivo',       icon: '🎉', color: '#ec4899' },
  otro:         { label: 'Otro',          icon: '📌', color: '#6b7280' },
}

export function EventsPanel() {
  const { events } = useAppStore()
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState<EventCategory | 'all'>('all')

  const filtered = useMemo(() => {
    const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date))
    return filter === 'all' ? sorted : sorted.filter(e => e.category === filter)
  }, [events, filter])

  const upcoming = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return events.filter(e => e.date >= today).length
  }, [events])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="page-title" style={{ marginBottom: 0 }}>Eventos</div>
          {upcoming > 0 && <span style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{upcoming} próximos</span>}
        </div>
        <button onClick={() => setShowForm(true)} style={{ background: '#10b981', border: 'none', borderRadius: 12, padding: '8px 14px', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ Evento</button>
      </div>

      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 14 }}>
        {[['all', '🗓️', 'Todos'] as const, ...Object.entries(CAT_CONFIG).map(([k, v]) => [k, v.icon, v.label] as const)].map(([k, icon, label]) => (
          <button key={k} onClick={() => setFilter(k as any)}
            style={{ flexShrink: 0, padding: '6px 12px', borderRadius: 20, border: `1px solid ${filter === k ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)'}`, background: filter === k ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)', color: filter === k ? '#fff' : '#9ca3af', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 13 }}>{icon}</span>{label}
          </button>
        ))}
      </div>

      {showForm && <EventForm onClose={() => setShowForm(false)} />}

      {filtered.length === 0 && !showForm ? (
        <div className="empty-state">
          <div className="empty-state-icon">🎓</div>
          <div className="empty-state-title">Sin eventos escolares</div>
          <div className="empty-state-sub">Añade reuniones, exámenes, excursiones...</div>
        </div>
      ) : (
        <div>{filtered.map(ev => <EventCard key={ev.id} event={ev} />)}</div>
      )}
    </div>
  )
}

function EventCard({ event }: { event: SchoolEvent }) {
  const { user } = useAuth()
  const cat = CAT_CONFIG[event.category]
  const today = new Date().toISOString().slice(0, 10)
  const isPast = event.date < today
  const isToday = event.date === today

  return (
    <div className="card" style={{ marginBottom: 8, opacity: isPast ? 0.6 : 1, borderLeft: `3px solid ${cat.color}`, borderRadius: '0 16px 16px 0' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: cat.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{cat.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{event.title}</span>
            {isToday && <span style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6 }}>¡Hoy!</span>}
            <span style={{ background: cat.color + '22', color: cat.color, fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 6 }}>{cat.label}</span>
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>
            📅 {formatDate(event.date)}{event.endDate ? ` → ${formatDate(event.endDate)}` : ''}{event.time ? ` · ⏰ ${event.time}` : ''}
          </div>
          {event.notes && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 5 }}>{event.notes}</div>}
        </div>
        {event.createdBy === user?.uid && (
          <button onClick={() => deleteEvent(event.id)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 16, padding: '0 2px', flexShrink: 0 }}>✕</button>
        )}
      </div>
    </div>
  )
}

function EventForm({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  const { children, selectedChildId } = useAppStore()
  const child = useMemo(() => children.find(c => c.id === selectedChildId) ?? null, [children, selectedChildId])

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<EventCategory>('reunion')
  const [date, setDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [allDay, setAllDay] = useState(true)
  const [time, setTime] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!user || !child || !title.trim() || !date) return
    setLoading(true)
    try {
      await createEvent({ childId: child.id, createdBy: user.uid, title: title.trim(), category, date, endDate: endDate || undefined, allDay, time: allDay ? undefined : (time || undefined), notes: notes.trim() || undefined })
      onClose()
    } finally { setLoading(false) }
  }

  return (
    <div className="card" style={{ marginBottom: 14, borderColor: 'rgba(16,185,129,0.3)' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#9ca3af', marginBottom: 12 }}>🎓 Nuevo evento</div>
      <div style={{ marginBottom: 10 }}>
        <div className="settings-label">Título</div>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej: Reunión trimestral" className="settings-input" />
      </div>
      <div style={{ marginBottom: 10 }}>
        <div className="settings-label">Categoría</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {(Object.entries(CAT_CONFIG) as [EventCategory, typeof CAT_CONFIG[EventCategory]][]).map(([k, v]) => (
            <button key={k} onClick={() => setCategory(k)}
              style={{ padding: '8px 4px', borderRadius: 10, border: `1px solid ${category === k ? v.color : 'rgba(255,255,255,0.1)'}`, background: category === k ? v.color + '22' : 'rgba(255,255,255,0.04)', color: category === k ? v.color : '#9ca3af', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <span style={{ fontSize: 16 }}>{v.icon}</span>{v.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: 10 }}>
        <div className="date-pair">
          <div><div className="date-pair-label">Fecha</div><input type="date" value={date} onChange={e => setDate(e.target.value)} className="settings-input" /></div>
          <div><div className="date-pair-label">Hasta (opcional)</div><input type="date" value={endDate} min={date} onChange={e => setEndDate(e.target.value)} className="settings-input" /></div>
        </div>
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#cbd5e1', fontSize: 13, fontWeight: 600 }}>
          <input type="checkbox" checked={allDay} onChange={e => { setAllDay(e.target.checked); if (e.target.checked) setTime('') }} />
          Evento de todo el día
        </label>
      </div>
      {!allDay && (
        <div style={{ marginBottom: 10 }}>
          <div className="settings-label">Hora (opcional)</div>
          <input type="time" value={time} onChange={e => setTime(e.target.value)} className="settings-input" />
        </div>
      )}
      <div style={{ marginBottom: 14 }}>
        <div className="settings-label">Observaciones (opcional)</div>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Detalles adicionales..." rows={2} className="settings-textarea" />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn-primary btn-outline" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
        <button style={{ flex:1, padding:11, borderRadius:12, border:"none", background:"#10b981", color:"#fff", fontSize:13, fontWeight:700, cursor:loading?"not-allowed":"pointer", opacity:(!title.trim()||!date||loading)?0.4:1 }} onClick={handleSubmit} disabled={!title.trim()||!date||loading}>
          {loading ? 'Guardando...' : 'Guardar evento'}
        </button>
      </div>
    </div>
  )
}
