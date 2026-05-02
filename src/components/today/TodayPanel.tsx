'use client'

import { useMemo } from 'react'
import { addDays } from 'date-fns'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { formatDate, getParentForDate, toISODate } from '@/lib/utils'

type TodayNavigateTab = 'calendar' | 'requests' | 'notes' | 'events' | 'medications'
type TodayAction = { label: string; tab: TodayNavigateTab; date?: string; openComposer?: 'note' | 'event' }

function noteMatchesDate(note: any, dateStr: string) {
  if (note.type === 'single') return note.date === dateStr
  if (note.type === 'range') return !!note.startDate && !!note.endDate && dateStr >= note.startDate && dateStr <= note.endDate
  return false
}

function eventMatchesDate(event: any, dateStr: string) {
  if (Array.isArray(event.cancelledDates) && event.cancelledDates.includes(dateStr)) return false

  if (event.recurrence === 'weekly') {
    if (!event.date || !event.recurrenceUntil) return false
    if (dateStr < event.date || dateStr > event.recurrenceUntil) return false
    const jsDay = new Date(dateStr + 'T12:00:00').getDay()
    const weekday = jsDay === 0 ? 7 : jsDay
    const baseDay = new Date(event.date + 'T12:00:00').getDay()
    const fallbackDay = baseDay === 0 ? 7 : baseDay
    const weekdays = Array.isArray(event.recurrenceWeekdays) && event.recurrenceWeekdays.length > 0 ? event.recurrenceWeekdays : [fallbackDay]
    return weekdays.includes(weekday)
  }

  if (event.recurrence === 'monthly') {
    if (!event.date || !event.recurrenceUntil) return false
    if (dateStr < event.date || dateStr > event.recurrenceUntil) return false
    return Number(dateStr.slice(8, 10)) === Number(String(event.date).slice(8, 10))
  }

  if (event.endDate) return dateStr >= event.date && dateStr <= event.endDate
  return event.date === dateStr
}

function requestMatchesDate(request: any, dateStr: string) {
  if (request.type === 'single') return request.date === dateStr
  return !!request.startDate && !!request.endDate && dateStr >= request.startDate && dateStr <= request.endDate
}

function getStatusLabel(status: string) {
  if (status === 'pending') return 'Pendiente'
  if (status === 'accepted') return 'Aceptado'
  if (status === 'rejected') return 'No aceptado'
  if (status === 'cancelled') return 'Cancelado'
  return status
}

function SummaryCard({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return (
    <div style={{ padding: 12, borderRadius: 18, border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.35, marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 22, lineHeight: 1, color: tone, fontWeight: 950 }}>{value}</div>
    </div>
  )
}

function TimelineItem({ title, meta, tone, onClick }: { title: string; meta: string; tone: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} style={{ width: '100%', textAlign: 'left', padding: '11px 12px', borderRadius: 16, border: '1px solid var(--border)', background: 'var(--bg-soft)', cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <div style={{ width: 9, height: 9, borderRadius: '50%', background: tone, flexShrink: 0 }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, color: 'var(--text-strong)', fontWeight: 850, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{meta}</div>
        </div>
      </div>
    </button>
  )
}

export function TodayPanel() {
  const { user } = useAuth()
  const {
    children,
    selectedChildId,
    pattern,
    overrides,
    specialPeriods,
    notes,
    events,
    requests,
    collaboratorAssignments,
    medications,
    medicationLogs,
    setCurrentMonth,
    setSelectedCalendarDate,
  } = useAppStore()

  const today = useMemo(() => new Date(), [])
  const todayStr = toISODate(today)
  const child = useMemo(() => children.find(item => item.id === selectedChildId) ?? null, [children, selectedChildId])
  const isParentForSelectedChild = !!child && !!user?.uid && child.parents.includes(user.uid)
  const isCollaboratorForSelectedChild = !!child && !!user?.uid && !!child.collaborators?.includes(user.uid)

  const custodyInfo = useMemo(() => {
    if (!child) return null
    const parentId = getParentForDate(today, pattern, overrides, child, specialPeriods)
    if (!parentId) return null
    return {
      parentId,
      name: child.parentNames?.[parentId] ?? 'Progenitor',
      color: child.parentColors?.[parentId] ?? '#6B7280',
      isMe: parentId === user?.uid,
    }
  }, [child, today, pattern, overrides, specialPeriods, user?.uid])

  const nextChange = useMemo(() => {
    if (!child || !custodyInfo) return null
    for (let offset = 1; offset <= 45; offset += 1) {
      const date = addDays(today, offset)
      const dateStr = toISODate(date)
      const parentId = getParentForDate(date, pattern, overrides, child, specialPeriods)
      if (parentId && parentId !== custodyInfo.parentId) {
        return {
          date: dateStr,
          name: child.parentNames?.[parentId] ?? 'Progenitor',
          color: child.parentColors?.[parentId] ?? '#6B7280',
        }
      }
    }
    return null
  }, [child, custodyInfo, today, pattern, overrides, specialPeriods])

  const todayEvents = useMemo(() => events.filter(event => eventMatchesDate(event, todayStr)), [events, todayStr])
  const todayNotes = useMemo(() => notes.filter(note => noteMatchesDate(note, todayStr)), [notes, todayStr])
  const todayRequests = useMemo(() => requests.filter(request => requestMatchesDate(request, todayStr)), [requests, todayStr])
  const pendingRequests = useMemo(() => {
    if (!user?.uid) return []
    return requests.filter(request => request.status === 'pending' && (request.toParentId === user.uid || request.fromParentId === user.uid))
  }, [requests, user?.uid])
  const pendingAssignments = useMemo(() => {
    if (!user?.uid) return []
    return collaboratorAssignments.filter(item => item.status === 'pending' && (item.collaboratorId === user.uid || item.createdByParentId === user.uid))
  }, [collaboratorAssignments, user?.uid])
  const activeMedicationsToday = useMemo(() => medications.filter(plan => plan.status === 'active' && todayStr >= plan.startDate && todayStr <= plan.endDate), [medications, todayStr])
  const medicationLogsToday = useMemo(() => medicationLogs.filter(log => log.scheduledDate === todayStr), [medicationLogs, todayStr])

  const goTo = (action: TodayAction) => {
    const targetDate = action.date || todayStr
    setSelectedCalendarDate(targetDate)
    setCurrentMonth(new Date(targetDate + 'T12:00:00'))
    if (typeof window === 'undefined') return
    window.dispatchEvent(new CustomEvent('custodia:navigate', {
      detail: {
        tab: action.tab,
        childId: child?.id,
        date: targetDate,
        openComposer: action.openComposer,
      },
    }))
  }

  if (!child) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">👶</div>
        <div className="empty-state-title">Empieza configurando un menor</div>
        <div className="empty-state-sub">Cuando haya un menor y un patrón de custodia, aquí verás el resumen de hoy.</div>
      </div>
    )
  }

  const canCreateFamilyItems = isParentForSelectedChild
  const roleLabel = isParentForSelectedChild ? 'Progenitor' : isCollaboratorForSelectedChild ? 'Colaborador' : 'Vista limitada'

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <section className="card" style={{ padding: 18, borderRadius: 24, background: 'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-soft) 100%)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 850, textTransform: 'uppercase', letterSpacing: 0.45, marginBottom: 6 }}>Hoy · {formatDate(todayStr, 'EEEE d MMMM')}</div>
            <div style={{ fontSize: 24, lineHeight: 1.08, color: 'var(--text-strong)', fontWeight: 950 }}>Resumen de {child.name}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              <span style={{ padding: '5px 9px', borderRadius: 999, background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 800 }}>{roleLabel}</span>
              {custodyInfo ? <span style={{ padding: '5px 9px', borderRadius: 999, background: 'var(--bg-card)', border: '1px solid var(--border)', color: custodyInfo.color, fontSize: 11, fontWeight: 850 }}>Custodia de {custodyInfo.name}{custodyInfo.isMe ? ' · tú' : ''}</span> : null}
            </div>
          </div>
          <button onClick={() => goTo({ label: 'Calendario', tab: 'calendar' })} style={{ flexShrink: 0, padding: '9px 11px', borderRadius: 14, border: '1px solid var(--border-hover)', background: 'var(--bg-card)', color: '#3B82F6', fontSize: 12, fontWeight: 850, cursor: 'pointer' }}>Abrir calendario</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 16 }}>
          <SummaryCard label="Eventos" value={todayEvents.length} tone="#10B981" />
          <SummaryCard label="Cambios" value={pendingRequests.length + pendingAssignments.length} tone="#3B82F6" />
          <SummaryCard label="Notas" value={todayNotes.length} tone="#F59E0B" />
          <SummaryCard label="Medicación" value={activeMedicationsToday.length} tone="#EC4899" />
        </div>
      </section>

      <section className="card" style={{ padding: 16, borderRadius: 22 }}>
        <div style={{ fontSize: 13, color: 'var(--text-strong)', fontWeight: 900, marginBottom: 10 }}>Próximo cambio</div>
        {nextChange ? (
          <button onClick={() => goTo({ label: 'Próximo cambio', tab: 'calendar', date: nextChange.date })} style={{ width: '100%', textAlign: 'left', padding: 14, borderRadius: 18, border: '1px solid var(--border)', background: 'var(--bg-soft)', cursor: 'pointer' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 800, marginBottom: 4 }}>{formatDate(nextChange.date, 'EEEE d MMMM')}</div>
            <div style={{ fontSize: 16, color: 'var(--text-strong)', fontWeight: 900 }}>Pasa a <span style={{ color: nextChange.color }}>{nextChange.name}</span></div>
          </button>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>No he encontrado un cambio en los próximos 45 días.</div>
        )}
      </section>

      <section className="card" style={{ padding: 16, borderRadius: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
          <div style={{ fontSize: 13, color: 'var(--text-strong)', fontWeight: 900 }}>Agenda de hoy</div>
          {canCreateFamilyItems ? <button onClick={() => goTo({ label: 'Nuevo evento', tab: 'events', openComposer: 'event' })} style={{ border: 'none', background: 'transparent', color: '#10B981', fontSize: 12, fontWeight: 850, cursor: 'pointer' }}>+ evento</button> : null}
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {todayEvents.length === 0 && todayNotes.length === 0 && todayRequests.length === 0 ? <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>No hay eventos, notas ni cambios marcados para hoy.</div> : null}
          {todayEvents.slice(0, 3).map(event => <TimelineItem key={`event-${event.id}`} title={event.title} meta={event.allDay ? 'Todo el día' : event.time || 'Sin hora'} tone="#10B981" onClick={() => goTo({ label: event.title, tab: 'events', date: event.date || todayStr })} />)}
          {todayRequests.slice(0, 2).map(request => <TimelineItem key={`request-${request.id}`} title={request.reason || 'Propuesta de cambio'} meta={getStatusLabel(request.status)} tone="#3B82F6" onClick={() => goTo({ label: 'Cambio', tab: 'requests', date: request.date || request.startDate || todayStr })} />)}
          {todayNotes.slice(0, 2).map(note => <TimelineItem key={`note-${note.id}`} title={note.text} meta={`Nota · ${note.createdByName || 'Progenitor'}`} tone="#F59E0B" onClick={() => goTo({ label: 'Nota', tab: 'notes', date: note.date || note.startDate || todayStr })} />)}
        </div>
      </section>

      <section className="card" style={{ padding: 16, borderRadius: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
          <div style={{ fontSize: 13, color: 'var(--text-strong)', fontWeight: 900 }}>Salud y avisos</div>
          <button onClick={() => goTo({ label: 'Medicación', tab: 'medications' })} style={{ border: 'none', background: 'transparent', color: '#EC4899', fontSize: 12, fontWeight: 850, cursor: 'pointer' }}>Ver medicación</button>
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {activeMedicationsToday.length === 0 ? <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>No hay medicación activa para hoy.</div> : null}
          {activeMedicationsToday.slice(0, 3).map(plan => {
            const logs = medicationLogsToday.filter(log => log.medicationId === plan.id)
            const meta = logs.length > 0 ? `${logs.length} registro(s) hoy` : `Cada ${plan.intervalHours} h desde ${plan.firstDoseTime}`
            return <TimelineItem key={`medication-${plan.id}`} title={plan.name} meta={meta} tone="#EC4899" onClick={() => goTo({ label: 'Medicación', tab: 'medications' })} />
          })}
        </div>
      </section>

      <section className="card" style={{ padding: 16, borderRadius: 22 }}>
        <div style={{ fontSize: 13, color: 'var(--text-strong)', fontWeight: 900, marginBottom: 10 }}>Acciones rápidas</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button className="btn-primary" style={{ background: '#3B82F6', color: '#fff' }} onClick={() => goTo({ label: 'Pedir cambio', tab: 'requests' })}>Pedir cambio</button>
          <button className="btn-primary btn-outline" onClick={() => goTo({ label: 'Calendario', tab: 'calendar' })}>Ver calendario</button>
          {canCreateFamilyItems ? <button className="btn-primary btn-outline" onClick={() => goTo({ label: 'Añadir nota', tab: 'notes', openComposer: 'note' })}>Añadir nota</button> : null}
          {canCreateFamilyItems ? <button className="btn-primary btn-outline" onClick={() => goTo({ label: 'Añadir evento', tab: 'events', openComposer: 'event' })}>Añadir evento</button> : null}
        </div>
      </section>
    </div>
  )
}
