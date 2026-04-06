'use client'
import { useState, useMemo } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { createEvent, deleteEvent, updateEvent } from '@/lib/db'
import { formatDate } from '@/lib/utils'
import type { SchoolEvent, EventCategory, EventRecurrence } from '@/types'

const CAT_CONFIG: Record<EventCategory, { label: string; icon: string; color: string }> = {
  reunion:      { label: 'Reunión',       icon: '👥', color: '#3b82f6' },
  excursion:    { label: 'Excursión',     icon: '🚌', color: '#10b981' },
  examen:       { label: 'Examen',        icon: '📝', color: '#f59e0b' },
  extraescolar: { label: 'Extraescolar',  icon: '⚽', color: '#8b5cf6' },
  festivo:      { label: 'Festivo',       icon: '🎉', color: '#ec4899' },
  otro:         { label: 'Personalizada', icon: '📌', color: '#6b7280' },
}
const WEEKDAYS = [
  { value: 1, label: 'L' },
  { value: 2, label: 'M' },
  { value: 3, label: 'X' },
  { value: 4, label: 'J' },
  { value: 5, label: 'V' },
  { value: 6, label: 'S' },
  { value: 7, label: 'D' },
]

function buildMonthlyDate(baseDate: string, dayOfMonth: number): string {
  if (!baseDate) return ''
  const [year, month] = baseDate.split('-')
  const safeDay = String(Math.max(1, Math.min(31, dayOfMonth))).padStart(2, '0')
  return `${year}-${month}-${safeDay}`
}

export function EventsPanel() {
  const { events } = useAppStore()
  const [showForm, setShowForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState<SchoolEvent | null>(null)
  const [filter, setFilter] = useState<EventCategory | 'all'>('all')

  const filtered = useMemo(() => {
    const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date) || ((a.time || '').localeCompare(b.time || '')))
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
        <button onClick={() => { setEditingEvent(null); setShowForm(true) }} style={{ background: '#10b981', border: 'none', borderRadius: 12, padding: '8px 14px', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ Evento</button>
      </div>

      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 14 }}>
        {[['all', '🗓️', 'Todos'] as const, ...Object.entries(CAT_CONFIG).map(([k, v]) => [k, v.icon, v.label] as const)].map(([k, icon, label]) => (
          <button key={k} onClick={() => setFilter(k as any)} style={{ flexShrink: 0, padding: '6px 12px', borderRadius: 20, border: `1px solid ${filter === k ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)'}`, background: filter === k ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)', color: filter === k ? '#fff' : '#9ca3af', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ fontSize: 13 }}>{icon}</span>{label}</button>
        ))}
      </div>

      {showForm && <EventForm event={editingEvent} onClose={() => { setShowForm(false); setEditingEvent(null) }} />}

      {filtered.length === 0 && !showForm ? (
        <div className="empty-state"><div className="empty-state-icon">🎓</div><div className="empty-state-title">Sin eventos escolares</div><div className="empty-state-sub">Añade reuniones, exámenes, excursiones...</div></div>
      ) : (
        <div>{filtered.map(ev => <EventCard key={ev.id} event={ev} onEdit={() => { setEditingEvent(ev); setShowForm(true) }} />)}</div>
      )}
    </div>
  )
}

function EventCard({ event, onEdit }: { event: SchoolEvent; onEdit: () => void }) {
  const { user } = useAuth()
  const cat = CAT_CONFIG[event.category]
  const today = new Date().toISOString().slice(0, 10)
  const isPast = event.date < today
  const isToday = event.date === today
  const categoryLabel = event.category === 'otro' ? (event.customCategory || cat.label) : cat.label
  const recurrenceLabel = event.recurrence === 'weekly' ? 'Semanal' : event.recurrence === 'monthly' ? 'Mensual' : ''

  return (
    <div className="card" style={{ marginBottom: 8, opacity: isPast ? 0.6 : 1, borderLeft: `3px solid ${cat.color}`, borderRadius: '0 16px 16px 0' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: cat.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{cat.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{event.title}</span>
            {isToday && <span style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6 }}>¡Hoy!</span>}
            <span style={{ background: cat.color + '22', color: cat.color, fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 6 }}>{categoryLabel}</span>
            {recurrenceLabel && <span style={{ background: 'rgba(139,92,246,0.18)', color: '#a78bfa', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6 }}>{recurrenceLabel}</span>}
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>📅 {formatDate(event.date)}{event.endDate ? ` → ${formatDate(event.endDate)}` : ''}{event.time ? ` · ⏰ ${event.time}` : event.allDay ? ' · Todo el día' : ''}</div>
          {event.notes && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 5 }}>{event.notes}</div>}
        </div>
        {event.createdBy === user?.uid && (
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            <button onClick={onEdit} style={{ background:'none', border:'none', color:'#9ca3af', cursor:'pointer', fontSize:12, fontWeight:700 }}>Editar</button>
            <button onClick={() => deleteEvent(event.id)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 16, padding: '0 2px', flexShrink: 0 }}>✕</button>
          </div>
        )}
      </div>
    </div>
  )
}

function EventForm({ event, onClose }: { event: SchoolEvent | null; onClose: () => void }) {
  const { user } = useAuth()
  const { children, selectedChildId } = useAppStore()
  const child = useMemo(() => children.find(c => c.id === selectedChildId) ?? null, [children, selectedChildId])

  const [title, setTitle] = useState(event?.title ?? '')
  const [category, setCategory] = useState<EventCategory>(event?.category ?? 'reunion')
  const [customCategory, setCustomCategory] = useState(event?.customCategory ?? '')
  const [date, setDate] = useState(event?.date ?? '')
  const [endDate, setEndDate] = useState(event?.endDate ?? '')
  const [allDay, setAllDay] = useState(event?.allDay ?? true)
  const [time, setTime] = useState(event?.time ?? '')
  const [notes, setNotes] = useState(event?.notes ?? '')
  const [recurrence, setRecurrence] = useState<EventRecurrence>(event?.recurrence ?? 'none')
  const [recurrenceUntil, setRecurrenceUntil] = useState(event?.recurrenceUntil ?? '')
  const [recurrenceWeekdays, setRecurrenceWeekdays] = useState<number[]>(event?.recurrenceWeekdays ?? [])
  const [monthlyDay, setMonthlyDay] = useState<number>(event ? Number((event.date || '').slice(8, 10)) || 1 : 1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isValid = !!user && !!child && !!title.trim() && !!date && (category !== 'otro' || !!customCategory.trim()) && (recurrence === 'none' || !!recurrenceUntil) && (recurrence !== 'weekly' || recurrenceWeekdays.length > 0) && (recurrence !== 'monthly' || (monthlyDay >= 1 && monthlyDay <= 31))

  const toggleWeekday = (day: number) => setRecurrenceWeekdays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort((a,b) => a-b))

  const handleSubmit = async () => {
    if (!user || !child || !isValid) return
    setLoading(true)
    setError('')
    try {
      const finalDate = recurrence === 'monthly' ? buildMonthlyDate(date, monthlyDay) : date
      const payload = {
        childId: child.id,
        createdBy: event?.createdBy ?? user.uid,
        title: title.trim(),
        category,
        customCategory: category === 'otro' ? customCategory.trim() : undefined,
        date: finalDate,
        endDate: endDate || undefined,
        allDay,
        time: allDay ? undefined : (time || undefined),
        notes: notes.trim() || undefined,
        recurrence,
        recurrenceUntil: recurrence === 'none' ? undefined : recurrenceUntil,
        recurrenceWeekdays: recurrence === 'weekly' ? recurrenceWeekdays : undefined,
      }
      if (event) await updateEvent(event.id, payload)
      else await createEvent(payload as any)
      onClose()
    } catch (e: any) {
      setError(e?.message || 'No se pudo guardar el evento')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card" style={{ marginBottom: 14, borderColor: 'rgba(16,185,129,0.3)' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#9ca3af', marginBottom: 12 }}>{event ? '✏️ Editar evento' : '🎓 Nuevo evento'}</div>

      <div style={{ marginBottom: 10 }}>
        <div className="settings-label">Título</div>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej: Reunión trimestral" className="settings-input" />
      </div>

      <div style={{ marginBottom: 10 }}>
        <div className="settings-label">Categoría</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {(Object.entries(CAT_CONFIG) as [EventCategory, typeof CAT_CONFIG[EventCategory]][]).map(([k, v]) => (
            <button key={k} onClick={() => setCategory(k)} style={{ padding: '8px 4px', borderRadius: 10, border: `1px solid ${category === k ? v.color : 'rgba(255,255,255,0.1)'}`, background: category === k ? v.color + '22' : 'rgba(255,255,255,0.04)', color: category === k ? v.color : '#9ca3af', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}><span style={{ fontSize: 16 }}>{v.icon}</span>{v.label}</button>
          ))}
        </div>
        {category === 'otro' && <input value={customCategory} onChange={e => setCustomCategory(e.target.value)} placeholder="Nombre de la categoría" className="settings-input" style={{ marginTop: 8 }} />}
      </div>

      <div style={{ marginBottom: 10 }}>
        <div className="date-pair">
          <div>
            <div className="date-pair-label">{recurrence === 'none' ? 'Fecha' : 'Empieza el'}</div>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="settings-input" />
          </div>
          <div>
            <div className="date-pair-label">Hasta (opcional)</div>
            <input type="date" value={endDate} min={date} onChange={e => setEndDate(e.target.value)} className="settings-input" />
          </div>
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

      {!event && (
        <div style={{ marginBottom: 10 }}>
          <div className="settings-label">Repetición</div>
          <div style={{ display:'flex', gap:8, marginBottom:8 }}>
            {(['none','weekly','monthly'] as EventRecurrence[]).map(r => (
              <button key={r} onClick={() => setRecurrence(r)} style={{ flex:1, padding:'8px 6px', borderRadius:10, border:`1px solid ${recurrence===r ? '#8b5cf6' : 'rgba(255,255,255,0.1)'}`, background:recurrence===r ? 'rgba(139,92,246,0.18)' : 'rgba(255,255,255,0.04)', color:recurrence===r ? '#a78bfa' : '#9ca3af', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                {r === 'none' ? 'Una vez' : r === 'weekly' ? 'Semanal' : 'Una vez al mes'}
              </button>
            ))}
          </div>

          {recurrence === 'weekly' && (
            <>
              <div className="settings-label" style={{ marginBottom: 6 }}>Días de la semana</div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
                {WEEKDAYS.map(day => (
                  <button key={day.value} onClick={() => toggleWeekday(day.value)} style={{ width:34, height:34, borderRadius:17, border:`1px solid ${recurrenceWeekdays.includes(day.value) ? '#8b5cf6' : 'rgba(255,255,255,0.1)'}`, background:recurrenceWeekdays.includes(day.value) ? 'rgba(139,92,246,0.18)' : 'rgba(255,255,255,0.04)', color:recurrenceWeekdays.includes(day.value) ? '#a78bfa' : '#9ca3af', fontSize:12, fontWeight:700, cursor:'pointer' }}>{day.label}</button>
                ))}
              </div>
              <div className="settings-label" style={{ marginBottom: 6 }}>Repetir hasta</div>
              <input type="date" value={recurrenceUntil} min={date} onChange={e => setRecurrenceUntil(e.target.value)} className="settings-input" />
            </>
          )}

          {recurrence === 'monthly' && (
            <>
              <div className="settings-label" style={{ marginBottom: 6 }}>Día del mes</div>
              <input type="number" min="1" max="31" value={monthlyDay} onChange={e => setMonthlyDay(Number(e.target.value || 1))} className="settings-input" />
              <div className="settings-label" style={{ marginTop: 8, marginBottom: 6 }}>Repetir hasta</div>
              <input type="date" value={recurrenceUntil} min={date} onChange={e => setRecurrenceUntil(e.target.value)} className="settings-input" />
            </>
          )}
        </div>
      )}

      <div style={{ marginBottom: 14 }}>
        <div className="settings-label">Observaciones (opcional)</div>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Detalles adicionales..." rows={2} className="settings-textarea" />
      </div>

      {error && <div style={{ marginBottom:10, padding:'8px 10px', borderRadius:10, background:'rgba(239,68,68,0.12)', color:'#fca5a5', fontSize:12 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn-primary btn-outline" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
        <button style={{ flex:1, padding:11, borderRadius:12, border:'none', background: isValid && !loading ? '#10b981' : 'rgba(255,255,255,0.08)', color: isValid && !loading ? '#fff' : '#6b7280', fontSize:13, fontWeight:700, cursor:isValid && !loading ? 'pointer' : 'not-allowed' }} onClick={handleSubmit} disabled={!isValid || loading}>{loading ? 'Guardando...' : (event ? 'Guardar cambios' : 'Guardar evento')}</button>
      </div>
    </div>
  )
}
