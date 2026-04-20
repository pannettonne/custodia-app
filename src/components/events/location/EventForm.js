'use client'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { createEvent, updateEvent } from '@/lib/db'
import { showToast } from '@/lib/toast'
import { CAT_CONFIG, buildMonthlyDate, notifyEventAssignmentPending } from './shared'
import { AssignmentSelector } from './AssignmentSelector'
import { LocationField } from './LocationField'
import { RecurrenceFields } from './RecurrenceFields'
import { ReminderSettings } from './ReminderSettings'

export function EventForm({ event, onClose, initialDate }) {
  const { user } = useAuth()
  const { children, selectedChildId } = useAppStore()
  const child = useMemo(() => children.find(c => c.id === selectedChildId) ?? null, [children, selectedChildId])

  const [title, setTitle] = useState(event?.title ?? '')
  const [category, setCategory] = useState(event?.category ?? 'reunion')
  const [customCategory, setCustomCategory] = useState(event?.customCategory ?? '')
  const [date, setDate] = useState(event?.date ?? initialDate ?? '')
  const [endDate, setEndDate] = useState(event?.endDate ?? '')
  const [allDay, setAllDay] = useState(event?.allDay ?? true)
  const [time, setTime] = useState(event?.time ?? '')
  const [notes, setNotes] = useState(event?.notes ?? '')
  const [recurrence, setRecurrence] = useState(event?.recurrence ?? 'none')
  const [recurrenceUntil, setRecurrenceUntil] = useState(event?.recurrenceUntil ?? '')
  const [recurrenceWeekdays, setRecurrenceWeekdays] = useState(event?.recurrenceWeekdays ?? [])
  const [monthlyDay, setMonthlyDay] = useState(event ? Number((event.date || '').slice(8, 10)) || 1 : 1)
  const [assignedParentId, setAssignedParentId] = useState(event?.assignedParentId ?? '')
  const [reminderEnabled, setReminderEnabled] = useState(event?.reminderEnabled ?? false)
  const [reminderDaysBefore, setReminderDaysBefore] = useState(event?.reminderDaysBefore ?? 1)
  const [reminderAudience, setReminderAudience] = useState(event?.reminderAudience ?? 'self')
  const [locationQuery, setLocationQuery] = useState(event?.locationName || event?.locationAddress || '')
  const [locationName, setLocationName] = useState(event?.locationName ?? '')
  const [locationAddress, setLocationAddress] = useState(event?.locationAddress ?? '')
  const [locationLatitude, setLocationLatitude] = useState(event?.locationLatitude)
  const [locationLongitude, setLocationLongitude] = useState(event?.locationLongitude)
  const [locationPlaceId, setLocationPlaceId] = useState(event?.locationPlaceId ?? '')
  const [locationResults, setLocationResults] = useState([])
  const [locationLoading, setLocationLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isValid = !!user && !!child && !!title.trim() && !!date &&
    (category !== 'otro' || !!customCategory.trim()) &&
    (recurrence === 'none' || !!recurrenceUntil) &&
    (recurrence !== 'weekly' || recurrenceWeekdays.length > 0) &&
    (recurrence !== 'monthly' || (monthlyDay >= 1 && monthlyDay <= 31))

  const toggleWeekday = day => {
    setRecurrenceWeekdays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort((a, b) => a - b))
  }

  const clearLocation = () => {
    setLocationQuery('')
    setLocationName('')
    setLocationAddress('')
    setLocationLatitude(undefined)
    setLocationLongitude(undefined)
    setLocationPlaceId('')
    setLocationResults([])
  }

  const selectLocation = item => {
    setLocationQuery(item.name)
    setLocationName(item.name)
    setLocationAddress(item.address)
    setLocationLatitude(item.latitude)
    setLocationLongitude(item.longitude)
    setLocationPlaceId(item.placeId)
    setLocationResults([])
  }

  useEffect(() => {
    const query = locationQuery.trim()
    if (query.length < 3) {
      setLocationResults([])
      setLocationLoading(false)
      return
    }
    if (locationPlaceId && query === (locationName.trim() || query)) {
      setLocationResults([])
      setLocationLoading(false)
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        setLocationLoading(true)
        const response = await fetch(`/api/location-search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        const data = await response.json()
        setLocationResults(Array.isArray(data.results) ? data.results : [])
      } catch {
        setLocationResults([])
      } finally {
        setLocationLoading(false)
      }
    }, 300)
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [locationName, locationPlaceId, locationQuery])

  const handleSubmit = async () => {
    if (!user || !child || !isValid) return
    setLoading(true)
    setError('')
    try {
      const finalDate = recurrence === 'monthly' ? buildMonthlyDate(date, monthlyDay) : date
      const otherParentId = child.parents.find(pid => pid !== user.uid)
      const wantsAssignment = !!assignedParentId && !!otherParentId
      const payload = {
        childId: child.id,
        createdBy: event?.createdBy ?? user.uid,
        title: title.trim(),
        category,
        customCategory: category === 'otro' ? customCategory.trim() : undefined,
        date: finalDate,
        endDate: endDate || undefined,
        allDay,
        time: allDay ? undefined : time || undefined,
        notes: notes.trim() || undefined,
        recurrence,
        recurrenceUntil: recurrence === 'none' ? undefined : recurrenceUntil,
        recurrenceWeekdays: recurrence === 'weekly' ? recurrenceWeekdays : undefined,
        assignedParentId: wantsAssignment ? assignedParentId : undefined,
        assignmentStatus: wantsAssignment ? 'pending' : undefined,
        assignmentRequestedBy: wantsAssignment ? user.uid : undefined,
        assignmentRequestedByName: wantsAssignment ? (user.displayName || user.email || 'Progenitor') : undefined,
        assignmentRequestToParentId: wantsAssignment ? otherParentId : undefined,
        reminderEnabled,
        reminderDaysBefore: reminderEnabled ? reminderDaysBefore : undefined,
        reminderAudience: reminderEnabled ? reminderAudience : undefined,
        locationName: locationName.trim() || undefined,
        locationAddress: locationAddress.trim() || undefined,
        locationLatitude,
        locationLongitude,
        locationPlaceId: locationPlaceId || undefined,
      }

      if (event) {
        await updateEvent(event.id, payload)
      } else {
        await createEvent(payload)
        if (wantsAssignment && otherParentId) {
          await notifyEventAssignmentPending({
            toUserId: otherParentId,
            childId: child.id,
            childName: child.name,
            eventTitle: title.trim(),
            dateKey: finalDate,
            requesterName: user.displayName || user.email || 'Progenitor',
          })
        }
      }

      showToast({ message: 'Evento guardado.', tone: 'success' })
      onClose()
    } catch (e) {
      const message = e?.message || 'No se pudo guardar el evento'
      setError(message)
      showToast({ message, tone: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card" style={{ marginBottom: 14, borderColor: 'rgba(16,185,129,0.3)', borderRadius: 20, background: 'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-soft) 100%)' }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 12 }}>{event ? 'Editar evento' : 'Nuevo evento'}</div>

      <div style={{ marginBottom: 10 }}>
        <div className="settings-label">Título</div>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej: Vacaciones de verano" className="settings-input" />
      </div>

      <div style={{ marginBottom: 10 }}>
        <div className="settings-label">Categoría</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {Object.entries(CAT_CONFIG).map(([key, value]) => (
            <button key={key} onClick={() => setCategory(key)} style={{ padding: '8px 4px', borderRadius: 12, border: `1px solid ${category === key ? value.color : 'var(--border)'}`, background: category === key ? `${value.color}22` : 'var(--bg-soft)', color: category === key ? value.color : 'var(--text-secondary)', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <span style={{ fontSize: 16 }}>{value.icon}</span>{value.label}
            </button>
          ))}
        </div>
        {category === 'otro' && <input value={customCategory} onChange={e => setCustomCategory(e.target.value)} placeholder="Nombre de la categoría" className="settings-input" style={{ marginTop: 8 }} />}
      </div>

      <div style={{ marginBottom: 10 }}>
        <div className="date-pair">
          <div>
            <div className="date-pair-label">{recurrence === 'none' ? 'Fecha' : 'Empieza el'}</div>
            <input type="date" value={date} onChange={e => { const next = e.target.value; setDate(next); if (!endDate || endDate < next) setEndDate(next); if (!recurrenceUntil || recurrenceUntil < next) setRecurrenceUntil(next) }} className="settings-input" />
          </div>
          <div>
            <div className="date-pair-label">Hasta (opcional)</div>
            <input type="date" value={endDate} min={date} onChange={e => setEndDate(e.target.value)} className="settings-input" />
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 13, fontWeight: 700 }}>
          <input type="checkbox" checked={allDay} onChange={e => { setAllDay(e.target.checked); if (e.target.checked) setTime('') }} />
          Evento de todo el día
        </label>
      </div>

      {!allDay && <div style={{ marginBottom: 10 }}><div className="settings-label">Hora (opcional)</div><input type="time" value={time} onChange={e => setTime(e.target.value)} className="settings-input" /></div>}

      <RecurrenceFields event={event} recurrence={recurrence} setRecurrence={setRecurrence} recurrenceWeekdays={recurrenceWeekdays} toggleWeekday={toggleWeekday} recurrenceUntil={recurrenceUntil} setRecurrenceUntil={setRecurrenceUntil} monthlyDay={monthlyDay} setMonthlyDay={setMonthlyDay} date={date} />
      <AssignmentSelector child={child} assignedParentId={assignedParentId} setAssignedParentId={setAssignedParentId} />
      <LocationField locationQuery={locationQuery} setLocationQuery={setLocationQuery} locationName={locationName} setLocationName={setLocationName} locationAddress={locationAddress} setLocationAddress={setLocationAddress} setLocationLatitude={setLocationLatitude} setLocationLongitude={setLocationLongitude} setLocationPlaceId={setLocationPlaceId} locationResults={locationResults} locationLoading={locationLoading} clearLocation={clearLocation} selectLocation={selectLocation} />
      <ReminderSettings reminderEnabled={reminderEnabled} setReminderEnabled={setReminderEnabled} reminderDaysBefore={reminderDaysBefore} setReminderDaysBefore={setReminderDaysBefore} reminderAudience={reminderAudience} setReminderAudience={setReminderAudience} />

      <div style={{ marginBottom: 14 }}>
        <div className="settings-label">Observaciones (opcional)</div>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Detalles adicionales..." rows={2} className="settings-textarea" />
      </div>

      {error && <div style={{ marginBottom: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(239,68,68,0.12)', color: '#fca5a5', fontSize: 12 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn-primary btn-outline" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
        <button style={{ flex: 1, padding: 11, borderRadius: 12, border: 'none', background: isValid && !loading ? '#10b981' : 'rgba(255,255,255,0.08)', color: isValid && !loading ? '#fff' : '#6b7280', fontSize: 13, fontWeight: 700, cursor: isValid && !loading ? 'pointer' : 'not-allowed' }} onClick={handleSubmit} disabled={!isValid || loading}>{loading ? 'Guardando...' : event ? 'Guardar cambios' : 'Guardar evento'}</button>
      </div>
    </div>
  )
}
