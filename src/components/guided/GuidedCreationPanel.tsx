'use client'

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { createEvent } from '@/lib/db'
import { getAvailabilityBlocksForUser } from '@/lib/availability-blocks-db'
import { findAvailabilityConflict, getAvailabilityConflictMessage } from '@/lib/availability-blocks'
import { showToast } from '@/lib/toast'
import { AssignmentSelector } from '@/components/events/location/AssignmentSelector'
import { DocumentAssociations } from '@/components/documents/DocumentAssociations'
import { LocationField } from '@/components/events/location/LocationField'
import { ReminderSettings } from '@/components/events/location/ReminderSettings'
import { RecurrenceFields } from '@/components/events/location/RecurrenceFields'
import { CAT_CONFIG, buildMonthlyDate, notifyEventAssignmentPending } from '@/components/events/location/shared'
import type { Child, EventCategory, EventRecurrence, EventReminderAudience } from '@/types'

type FlowKind = 'event' | 'change' | 'block' | 'treatment' | 'note'

type WizardStep = {
  id: string
  caption: string
  eyebrow: string
  question: string
  helper: string
}

const EVENT_STEPS: WizardStep[] = [
  { id: 'kind', caption: 'Elegir qué crear', eyebrow: 'Inicio', question: '¿Qué quieres crear?', helper: 'De momento el flujo guiado está preparado para eventos. Después añadiremos el resto.' },
  { id: 'child', caption: 'Para quién es', eyebrow: 'Menor', question: '¿Para quién es?', helper: 'Elige el menor al que pertenece este evento.' },
  { id: 'category', caption: 'Tipo de evento', eyebrow: 'Categoría', question: '¿Qué tipo de evento es?', helper: 'Esto nos ayuda a mostrar los campos adecuados y a identificarlo rápido.' },
  { id: 'title', caption: 'Nombre', eyebrow: 'Título', question: '¿Cómo lo llamamos?', helper: 'Usa un nombre corto y claro.' },
  { id: 'when', caption: 'Fecha y hora', eyebrow: 'Cuándo', question: '¿Cuándo será?', helper: 'Indica fecha desde y, si aplica, fecha hasta. La segunda puede quedar vacía.' },
  { id: 'where', caption: 'Lugar', eyebrow: 'Dónde', question: '¿Dónde será?', helper: 'Añade el lugar si aporta contexto o ayuda para llegar.' },
  { id: 'repeat', caption: 'Avisos y repetición', eyebrow: 'Recordatorio', question: '¿Quieres recordatorios o repetición?', helper: 'Déjalo simple si es un evento puntual.' },
  { id: 'assignment', caption: 'Asignación', eyebrow: 'Custodia', question: '¿Hay que asignarlo a alguien?', helper: 'Opcional. Si lo asignas, el otro progenitor recibirá la solicitud correspondiente.' },
  { id: 'extras', caption: 'Notas y documentos', eyebrow: 'Detalles', question: '¿Quieres añadir algo más?', helper: 'Puedes adjuntar observaciones o documentos ya guardados.' },
  { id: 'summary', caption: 'Resumen final', eyebrow: 'Revisión', question: '¿Está todo correcto?', helper: 'Revisa los datos antes de guardar.' },
]

const FLOW_OPTIONS: Array<{ id: FlowKind; title: string; subtitle: string; icon: string; tone: string; enabled: boolean }> = [
  { id: 'event', title: 'Evento', subtitle: 'Citas, colegio, actividades y vacaciones.', icon: '📅', tone: '#7c3aed', enabled: true },
  { id: 'change', title: 'Cambio', subtitle: 'Solicitudes de cambio de custodia.', icon: '🔄', tone: '#10b981', enabled: false },
  { id: 'block', title: 'Bloqueo', subtitle: 'Días o periodos no disponibles.', icon: '🔒', tone: '#f59e0b', enabled: false },
  { id: 'treatment', title: 'Tratamiento', subtitle: 'Medicamentos, terapias y seguimiento.', icon: '💗', tone: '#ec4899', enabled: false },
  { id: 'note', title: 'Nota', subtitle: 'Avisos, apuntes y recordatorios.', icon: '💬', tone: '#3b82f6', enabled: false },
]

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function defaultTitleForCategory(category: EventCategory, customCategory: string) {
  if (category === 'otro') return customCategory.trim() || 'Evento'
  const label = CAT_CONFIG[category]?.label || 'Evento'
  return label === 'Médico' ? 'Cita médica' : label
}

function progressStyle(index: number, current: number): CSSProperties {
  return {
    flex: 1,
    height: 5,
    borderRadius: 999,
    background: index <= current ? 'linear-gradient(90deg, #7c3aed, #4f46e5)' : 'rgba(148,163,184,0.24)',
    transition: 'background 0.18s ease',
  }
}

function SelectCard({
  title,
  subtitle,
  icon,
  tone,
  selected,
  disabled,
  right,
  onClick,
}: {
  title: string
  subtitle?: string
  icon: ReactNode
  tone: string
  selected?: boolean
  disabled?: boolean
  right?: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        borderRadius: 18,
        border: `1px solid ${selected ? tone : 'var(--border)'}`,
        background: selected ? `${tone}18` : 'var(--bg-card)',
        color: 'var(--text-strong)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.72 : 1,
        boxShadow: selected ? `0 14px 34px ${tone}20` : 'var(--card-shadow)',
        textAlign: 'left',
      }}
    >
      <span style={{ width: 42, height: 42, borderRadius: 14, background: `${tone}18`, color: tone, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21, flexShrink: 0 }}>
        {icon}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 950, color: selected ? tone : 'var(--text-strong)' }}>{title}</span>
        {subtitle ? <span style={{ display: 'block', fontSize: 11, lineHeight: 1.35, marginTop: 3, color: 'var(--text-secondary)' }}>{subtitle}</span> : null}
      </span>
      <span style={{ flexShrink: 0 }}>{right ?? (selected ? '✓' : '›')}</span>
    </button>
  )
}

function FieldCard({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section style={{ padding: 14, borderRadius: 20, border: '1px solid var(--border)', background: 'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-soft) 100%)', boxShadow: 'var(--card-shadow)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: '#7c3aed', fontSize: 13, fontWeight: 950 }}>
        <span>{icon}</span>
        <span>{title}</span>
      </div>
      {children}
    </section>
  )
}

function SummaryRow({ label, value, icon }: { label: string; value: ReactNode; icon: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ width: 28, height: 28, borderRadius: 10, background: 'rgba(124,58,237,0.12)', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)', fontWeight: 800 }}>{label}</span>
      <span style={{ fontSize: 12, color: 'var(--text-strong)', fontWeight: 900, textAlign: 'right' }}>{value}</span>
    </div>
  )
}

export function GuidedCreationPanel() {
  const { user } = useAuth()
  const {
    children,
    selectedChildId,
    setSelectedChildId,
    documents,
  } = useAppStore()

  const initialChildId = selectedChildId || children[0]?.id || ''
  const [step, setStep] = useState(0)
  const [flowKind, setFlowKind] = useState<FlowKind>('event')
  const [childId, setChildId] = useState(initialChildId)
  const child = useMemo(() => children.find(item => item.id === childId) ?? null, [children, childId])

  const [category, setCategory] = useState<EventCategory>('medico')
  const [customCategory, setCustomCategory] = useState('')
  const [title, setTitle] = useState('Cita médica')
  const [date, setDate] = useState(todayISO())
  const [endDate, setEndDate] = useState('')
  const [allDay, setAllDay] = useState(false)
  const [time, setTime] = useState('10:30')
  const [endTime, setEndTime] = useState('')
  const [locationQuery, setLocationQuery] = useState('')
  const [locationName, setLocationName] = useState('')
  const [locationAddress, setLocationAddress] = useState('')
  const [locationLatitude, setLocationLatitude] = useState<number | undefined>(undefined)
  const [locationLongitude, setLocationLongitude] = useState<number | undefined>(undefined)
  const [locationPlaceId, setLocationPlaceId] = useState('')
  const [locationResults, setLocationResults] = useState<any[]>([])
  const [locationLoading, setLocationLoading] = useState(false)
  const [reminderEnabled, setReminderEnabled] = useState(false)
  const [reminderDaysBefore, setReminderDaysBefore] = useState(1)
  const [reminderAudience, setReminderAudience] = useState<EventReminderAudience>('self')
  const [recurrence, setRecurrence] = useState<EventRecurrence>('none')
  const [recurrenceUntil, setRecurrenceUntil] = useState('')
  const [recurrenceWeekdays, setRecurrenceWeekdays] = useState<number[]>([])
  const [monthlyDay, setMonthlyDay] = useState(Number(todayISO().slice(8, 10)))
  const [assignedParentId, setAssignedParentId] = useState('')
  const [notes, setNotes] = useState('')
  const [documentIds, setDocumentIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const selectedStep = EVENT_STEPS[step]
  const hasValidTimeRange = allDay || !time || !endTime || time < endTime
  const hasValidDateRange = !endDate || endDate >= date
  const hasValidRecurrence = recurrence === 'none' || (!!recurrenceUntil && (recurrence !== 'weekly' || recurrenceWeekdays.length > 0) && (recurrence !== 'monthly' || (monthlyDay >= 1 && monthlyDay <= 31)))
  const effectiveTitle = title.trim() || defaultTitleForCategory(category, customCategory)
  const linkedDocuments = documentIds.map(id => documents.find(doc => doc.id === id)).filter(Boolean)
  const currentCategoryLabel = category === 'otro' ? customCategory.trim() || 'Personalizada' : CAT_CONFIG[category]?.label || 'Evento'

  useEffect(() => {
    if (!childId && initialChildId) setChildId(initialChildId)
  }, [childId, initialChildId])

  useEffect(() => {
    if (selectedChildId && selectedChildId !== childId && step <= 1) setChildId(selectedChildId)
  }, [selectedChildId, childId, step])

  useEffect(() => {
    if (category !== 'otro' && (!title.trim() || title === 'Cita médica' || title === 'Reunión' || title === 'Examen' || title === 'Extraescolar' || title === 'Cumpleaños' || title === 'Vacaciones')) {
      setTitle(defaultTitleForCategory(category, customCategory))
    }
  }, [category, customCategory, title])

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

  const clearLocation = () => {
    setLocationQuery('')
    setLocationName('')
    setLocationAddress('')
    setLocationLatitude(undefined)
    setLocationLongitude(undefined)
    setLocationPlaceId('')
    setLocationResults([])
  }

  const selectLocation = (item: any) => {
    setLocationQuery(item.name)
    setLocationName(item.name)
    setLocationAddress(item.address)
    setLocationLatitude(item.latitude)
    setLocationLongitude(item.longitude)
    setLocationPlaceId(item.placeId)
    setLocationResults([])
  }

  const toggleWeekday = (day: number) => {
    setRecurrenceWeekdays(prev => prev.includes(day) ? prev.filter(value => value !== day) : [...prev, day].sort((a, b) => a - b))
  }

  const selectFlowKind = (kind: FlowKind) => {
    setFlowKind(kind)
    if (kind !== 'event') {
      showToast({ message: 'Ese flujo lo añadiremos después. Ahora puedes probar Evento.', tone: 'info' })
      return
    }
    setStep(1)
  }

  const canContinue = () => {
    if (step === 0) return flowKind === 'event'
    if (step === 1) return !!child
    if (step === 2) return category !== 'otro' || !!customCategory.trim()
    if (step === 3) return !!effectiveTitle.trim()
    if (step === 4) return !!date && hasValidDateRange && hasValidTimeRange
    if (step === 6) return hasValidRecurrence
    return true
  }

  const goNext = () => {
    setError('')
    if (!canContinue()) {
      setError('Completa esta pantalla para continuar.')
      return
    }
    setStep(current => Math.min(EVENT_STEPS.length - 1, current + 1))
  }

  const goBack = () => {
    setError('')
    setStep(current => Math.max(0, current - 1))
  }

  const resetFlow = () => {
    setStep(0)
    setFlowKind('event')
    setCategory('medico')
    setCustomCategory('')
    setTitle('Cita médica')
    setDate(todayISO())
    setEndDate('')
    setAllDay(false)
    setTime('10:30')
    setEndTime('')
    clearLocation()
    setReminderEnabled(false)
    setReminderDaysBefore(1)
    setReminderAudience('self')
    setRecurrence('none')
    setRecurrenceUntil('')
    setRecurrenceWeekdays([])
    setMonthlyDay(Number(todayISO().slice(8, 10)))
    setAssignedParentId('')
    setNotes('')
    setDocumentIds([])
    setSaving(false)
    setError('')
  }

  const saveEvent = async () => {
    if (!user || !child || !canContinue()) return
    setSaving(true)
    setError('')
    try {
      const finalDate = recurrence === 'monthly' ? buildMonthlyDate(date, monthlyDay) : date
      const otherParentId = child.parents.find(pid => pid !== user.uid)
      const wantsAssignment = !!assignedParentId && !!otherParentId

      if (wantsAssignment && assignedParentId) {
        const availabilityBlocks = await getAvailabilityBlocksForUser(child.id, assignedParentId)
        const conflict = findAvailabilityConflict({
          blocks: availabilityBlocks,
          startDate: finalDate,
          endDate: endDate || finalDate,
          startTime: allDay ? undefined : (time || undefined),
          endTime: allDay ? undefined : (endTime || undefined),
        })
        if (conflict) {
          const targetParentName = child.parentNames?.[assignedParentId] || 'El progenitor asignado'
          throw new Error(getAvailabilityConflictMessage(targetParentName, conflict))
        }
      }

      const payload: any = {
        childId: child.id,
        createdBy: user.uid,
        title: effectiveTitle.trim(),
        category,
        customCategory: category === 'otro' ? customCategory.trim() : undefined,
        date: finalDate,
        endDate: endDate || undefined,
        allDay,
        time: allDay ? undefined : time || undefined,
        endTime: allDay ? undefined : endTime || undefined,
        notes: notes.trim() || undefined,
        documentIds,
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

      const eventId = await createEvent(payload)
      if (wantsAssignment && otherParentId) {
        await notifyEventAssignmentPending({
          toUserId: otherParentId,
          childId: child.id,
          childName: child.name,
          eventTitle: effectiveTitle.trim(),
          dateKey: finalDate,
          requesterName: user.displayName || user.email || 'Progenitor',
        })
      }

      setSelectedChildId(child.id)
      showToast({ message: 'Evento creado desde la creación guiada.', tone: 'success' })
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('custodia:navigate', { detail: { tab: 'events', childId: child.id, date: finalDate, focusTargetId: `event-${eventId}` } }))
      }
      resetFlow()
    } catch (eventError: any) {
      const message = eventError?.message || 'No se pudo guardar el evento.'
      setError(message)
      showToast({ message, tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const renderStep = () => {
    if (!child && step > 0) {
      return (
        <FieldCard title="Falta configurar un menor" icon="👶">
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.45 }}>Para crear eventos necesitas tener al menos un menor configurado.</div>
          <button type="button" className="btn-primary" style={{ marginTop: 12, width: '100%' }} onClick={() => window.dispatchEvent(new CustomEvent('custodia:navigate', { detail: { tab: 'settings' } }))}>Ir a ajustes</button>
        </FieldCard>
      )
    }

    if (step === 0) {
      return (
        <div style={{ display: 'grid', gap: 10 }}>
          {FLOW_OPTIONS.map(option => (
            <SelectCard
              key={option.id}
              title={option.title}
              subtitle={option.enabled ? option.subtitle : `${option.subtitle} Próximamente.`}
              icon={option.icon}
              tone={option.tone}
              selected={flowKind === option.id && option.enabled}
              disabled={false}
              right={option.enabled ? undefined : <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 900 }}>Pronto</span>}
              onClick={() => selectFlowKind(option.id)}
            />
          ))}
        </div>
      )
    }

    if (step === 1) {
      return (
        <div style={{ display: 'grid', gap: 10 }}>
          {children.map(item => (
            <SelectCard
              key={item.id}
              title={item.name}
              subtitle="Calendario familiar"
              icon="👧"
              tone="#7c3aed"
              selected={item.id === childId}
              onClick={() => setChildId(item.id)}
            />
          ))}
        </div>
      )
    }

    if (step === 2) {
      return (
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
            {Object.entries(CAT_CONFIG).map(([key, value]) => (
              <button
                key={key}
                type="button"
                onClick={() => setCategory(key as EventCategory)}
                style={{
                  padding: '14px 8px',
                  minHeight: 86,
                  borderRadius: 18,
                  border: `1px solid ${category === key ? value.color : 'var(--border)'}`,
                  background: category === key ? `${value.color}20` : 'var(--bg-card)',
                  color: category === key ? value.color : 'var(--text-secondary)',
                  cursor: 'pointer',
                  boxShadow: category === key ? `0 14px 34px ${value.color}18` : 'var(--card-shadow)',
                }}
              >
                <div style={{ fontSize: 24, marginBottom: 8 }}>{value.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 950 }}>{value.label}</div>
              </button>
            ))}
          </div>
          {category === 'otro' ? <input value={customCategory} onChange={event => setCustomCategory(event.target.value)} placeholder="Nombre de la categoría" className="settings-input" /> : null}
        </div>
      )
    }

    if (step === 3) {
      return (
        <FieldCard title="Nombre del evento" icon="✏️">
          <input value={title} onChange={event => setTitle(event.target.value)} placeholder="Ej: Revisión pediatra" className="settings-input" autoFocus />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            {[defaultTitleForCategory(category, customCategory), 'Reunión colegio', 'Actividad extraescolar'].filter(Boolean).map(suggestion => (
              <button key={suggestion} type="button" onClick={() => setTitle(suggestion)} style={{ border: '1px solid var(--border)', background: 'var(--bg-soft)', color: 'var(--text-secondary)', borderRadius: 999, padding: '7px 10px', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>{suggestion}</button>
            ))}
          </div>
        </FieldCard>
      )
    }

    if (step === 4) {
      return (
        <FieldCard title="Fecha y hora" icon="📅">
          <div style={{ display: 'grid', gap: 10 }}>
            <div>
              <div className="settings-label">Fecha desde</div>
              <input type="date" value={date} onChange={event => { const next = event.target.value; setDate(next); if (endDate && endDate < next) setEndDate(''); if (recurrenceUntil && recurrenceUntil < next) setRecurrenceUntil(next) }} className="settings-input" />
            </div>
            <div>
              <div className="settings-label">Fecha hasta (opcional)</div>
              <input type="date" value={endDate} min={date || undefined} onChange={event => setEndDate(event.target.value)} className="settings-input" />
            </div>
            <div className="type-toggle">
              <button type="button" className={`type-btn ${allDay ? 'active' : ''}`} onClick={() => { setAllDay(true); setTime(''); setEndTime('') }}>☀️ Todo el día</button>
              <button type="button" className={`type-btn ${!allDay ? 'active' : ''}`} onClick={() => setAllDay(false)}>🕒 Con hora</button>
            </div>
            {!allDay ? (
              <div className="date-pair">
                <div>
                  <div className="date-pair-label">Hora desde</div>
                  <input type="time" value={time} onChange={event => setTime(event.target.value)} className="settings-input" />
                </div>
                <div>
                  <div className="date-pair-label">Hora hasta</div>
                  <input type="time" value={endTime} min={time || undefined} onChange={event => setEndTime(event.target.value)} className="settings-input" />
                </div>
              </div>
            ) : null}
            {!hasValidDateRange ? <div style={{ color: '#f87171', fontSize: 12, fontWeight: 800 }}>La fecha hasta debe ser posterior o igual a la fecha desde.</div> : null}
            {!hasValidTimeRange ? <div style={{ color: '#f87171', fontSize: 12, fontWeight: 800 }}>La hora hasta debe ser posterior a la hora desde.</div> : null}
          </div>
        </FieldCard>
      )
    }

    if (step === 5) {
      return (
        <FieldCard title="Lugar del evento" icon="📍">
          <LocationField
            locationQuery={locationQuery}
            setLocationQuery={setLocationQuery}
            locationName={locationName}
            setLocationName={setLocationName}
            locationAddress={locationAddress}
            setLocationAddress={setLocationAddress}
            setLocationLatitude={setLocationLatitude}
            setLocationLongitude={setLocationLongitude}
            setLocationPlaceId={setLocationPlaceId}
            locationResults={locationResults}
            locationLoading={locationLoading}
            clearLocation={clearLocation}
            selectLocation={selectLocation}
          />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>Puedes dejarlo vacío si no aplica.</div>
        </FieldCard>
      )
    }

    if (step === 6) {
      return (
        <div style={{ display: 'grid', gap: 12 }}>
          <FieldCard title="Recordatorio" icon="🔔">
            <ReminderSettings reminderEnabled={reminderEnabled} setReminderEnabled={setReminderEnabled} reminderDaysBefore={reminderDaysBefore} setReminderDaysBefore={setReminderDaysBefore} reminderAudience={reminderAudience} setReminderAudience={setReminderAudience} />
          </FieldCard>
          <FieldCard title="Repetición" icon="🔁">
            <RecurrenceFields event={null} recurrence={recurrence} setRecurrence={setRecurrence} recurrenceWeekdays={recurrenceWeekdays} toggleWeekday={toggleWeekday} recurrenceUntil={recurrenceUntil} setRecurrenceUntil={setRecurrenceUntil} monthlyDay={monthlyDay} setMonthlyDay={setMonthlyDay} date={date} />
          </FieldCard>
        </div>
      )
    }

    if (step === 7) {
      return (
        <FieldCard title="Asignación opcional" icon="🤝">
          {child ? <AssignmentSelector child={child} assignedParentId={assignedParentId} setAssignedParentId={setAssignedParentId} /> : null}
          {!child || child.parents.length <= 1 ? <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No hay otro progenitor configurado para solicitar asignación.</div> : null}
        </FieldCard>
      )
    }

    if (step === 8) {
      return (
        <div style={{ display: 'grid', gap: 12 }}>
          <FieldCard title="Observaciones" icon="📝">
            <textarea value={notes} onChange={event => setNotes(event.target.value)} rows={4} placeholder="Añade detalles importantes..." className="settings-textarea" />
          </FieldCard>
          <FieldCard title="Documentos" icon="📎">
            {child ? <DocumentAssociations childId={child.id} value={documentIds} onChange={setDocumentIds} /> : null}
            {linkedDocuments.length > 0 ? <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>{linkedDocuments.map(doc => <span key={doc.id} style={{ background: 'var(--bg-soft)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 800, padding: '5px 8px', borderRadius: 999 }}>📎 {doc.title || 'Documento'}</span>)}</div> : null}
          </FieldCard>
        </div>
      )
    }

    return (
      <FieldCard title="Resumen" icon="✅">
        <div style={{ padding: '2px 2px 0' }}>
          <SummaryRow icon="📌" label="Tipo" value={currentCategoryLabel} />
          <SummaryRow icon="👶" label="Para" value={child?.name || '—'} />
          <SummaryRow icon="✏️" label="Título" value={effectiveTitle} />
          <SummaryRow icon="📅" label="Fecha" value={endDate ? `${date} → ${endDate}` : date} />
          <SummaryRow icon="🕒" label="Hora" value={allDay ? 'Todo el día' : `${time || 'Sin hora'}${endTime ? `-${endTime}` : ''}`} />
          <SummaryRow icon="📍" label="Lugar" value={locationName || locationAddress || 'Sin lugar'} />
          <SummaryRow icon="🔔" label="Recordatorio" value={reminderEnabled ? 'Activado' : 'No'} />
          <SummaryRow icon="🔁" label="Repetición" value={recurrence === 'none' ? 'No' : recurrence === 'weekly' ? 'Semanal' : 'Mensual'} />
          <SummaryRow icon="🤝" label="Asignación" value={assignedParentId && child ? child.parentNames?.[assignedParentId] || 'Progenitor' : 'No'} />
          <SummaryRow icon="📎" label="Documentos" value={documentIds.length > 0 ? documentIds.length : 'No'} />
        </div>
      </FieldCard>
    )
  }

  return (
    <section style={{ display: 'grid', gap: 14, width: '100%', maxWidth: 620, margin: '0 auto', paddingBottom: 18 }}>
      <div className="card" style={{ padding: 18, borderRadius: 26, background: 'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-soft) 100%)', border: '1px solid rgba(124,58,237,0.24)', boxShadow: 'var(--card-shadow)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10, color: '#7c3aed', fontWeight: 950, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 5 }}>Creación guiada</div>
            <h1 style={{ margin: 0, color: 'var(--text-strong)', fontSize: 24, lineHeight: 1.05, letterSpacing: -0.7 }}>Una pregunta cada vez</h1>
            <p style={{ margin: '8px 0 0', color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.45 }}>Crea un evento paso a paso, sin enfrentarte a todo el formulario de golpe.</p>
          </div>
          <button type="button" onClick={resetFlow} style={{ border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-secondary)', borderRadius: 999, padding: '8px 11px', fontSize: 11, fontWeight: 900, cursor: 'pointer', flexShrink: 0 }}>Reiniciar</button>
        </div>
      </div>

      <div className="card" style={{ padding: 16, borderRadius: 26, background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
          <span style={{ background: 'rgba(124,58,237,0.12)', color: '#8b5cf6', borderRadius: 999, padding: '6px 9px', fontSize: 11, fontWeight: 950 }}>Paso {step + 1} de {EVENT_STEPS.length}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 850 }}>{selectedStep.caption}</span>
        </div>
        <div style={{ display: 'flex', gap: 5, marginBottom: 18 }}>
          {EVENT_STEPS.map((item, index) => <span key={item.id} style={progressStyle(index, step)} />)}
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: '#7c3aed', fontSize: 11, fontWeight: 950, textTransform: 'uppercase', letterSpacing: 0.45, marginBottom: 6 }}>{selectedStep.eyebrow}</div>
          <h2 style={{ margin: 0, color: 'var(--text-strong)', fontSize: 21, lineHeight: 1.1, letterSpacing: -0.4 }}>{selectedStep.question}</h2>
          <p style={{ margin: '8px 0 0', color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.45 }}>{selectedStep.helper}</p>
        </div>

        {renderStep()}

        {error ? <div style={{ marginTop: 12, padding: '9px 10px', borderRadius: 12, background: 'rgba(239,68,68,0.12)', color: '#fca5a5', fontSize: 12, fontWeight: 800 }}>{error}</div> : null}

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button type="button" className="btn-primary btn-outline" style={{ flex: 1, minWidth: 0 }} onClick={goBack} disabled={step === 0 || saving}>Anterior</button>
          {step < EVENT_STEPS.length - 1 ? (
            <button type="button" style={{ flex: 1, minWidth: 0, padding: 11, borderRadius: 13, border: 'none', background: canContinue() ? 'linear-gradient(135deg, #7c3aed, #4f46e5)' : 'rgba(255,255,255,0.08)', color: canContinue() ? '#fff' : '#6b7280', fontSize: 13, fontWeight: 900, cursor: canContinue() ? 'pointer' : 'not-allowed', boxShadow: canContinue() ? '0 14px 28px rgba(124,58,237,0.24)' : 'none' }} onClick={goNext} disabled={!canContinue() || saving}>Siguiente</button>
          ) : (
            <button type="button" style={{ flex: 1, minWidth: 0, padding: 11, borderRadius: 13, border: 'none', background: !saving ? 'linear-gradient(135deg, #7c3aed, #4f46e5)' : 'rgba(255,255,255,0.08)', color: !saving ? '#fff' : '#6b7280', fontSize: 13, fontWeight: 900, cursor: !saving ? 'pointer' : 'not-allowed', boxShadow: !saving ? '0 14px 28px rgba(124,58,237,0.24)' : 'none' }} onClick={saveEvent} disabled={saving}>{saving ? 'Guardando...' : 'Guardar evento'}</button>
          )}
        </div>
      </div>
    </section>
  )
}
