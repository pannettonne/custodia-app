'use client'

import { useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { getParentForDate, PERIOD_LABELS, formatDate } from '@/lib/utils'
import { blockOverlapsDate, formatAvailabilityBlockLabel } from '@/lib/availability-blocks'
import { RequestModal } from '@/components/requests/RequestModal'
import { CollaboratorAssignmentModal } from '@/components/collaborators/CollaboratorAssignmentModal'
import { cancelEventOccurrence, restoreEventOccurrence } from '@/lib/db'
import { DayEventItem } from '@/components/calendar/DayEventItem'

function noteMatchesDate(note: any, dateStr: string) {
  if (note.type === 'single') return note.date === dateStr
  if (note.type === 'range') return !!note.startDate && !!note.endDate && dateStr >= note.startDate && dateStr <= note.endDate
  return false
}

function getEventOccurrenceState(event: any, dateStr: string) {
  const cancelled = Array.isArray(event.cancelledDates) && event.cancelledDates.includes(dateStr)

  if (event.recurrence === 'weekly') {
    if (!event.date || !event.recurrenceUntil) return { matches: false, cancelled }
    if (dateStr < event.date || dateStr > event.recurrenceUntil) return { matches: false, cancelled }
    const jsDay = new Date(dateStr + 'T12:00:00').getDay()
    const weekday = jsDay === 0 ? 7 : jsDay
    const weekdays = Array.isArray(event.recurrenceWeekdays) && event.recurrenceWeekdays.length > 0
      ? event.recurrenceWeekdays
      : [(() => {
          const baseDay = new Date(event.date + 'T12:00:00').getDay()
          return baseDay === 0 ? 7 : baseDay
        })()]
    return { matches: weekdays.includes(weekday), cancelled }
  }

  if (event.recurrence === 'monthly') {
    if (!event.date || !event.recurrenceUntil) return { matches: false, cancelled }
    if (dateStr < event.date || dateStr > event.recurrenceUntil) return { matches: false, cancelled }
    const targetDay = Number((event.date || '').slice(8, 10))
    return { matches: Number(dateStr.slice(8, 10)) === targetDay, cancelled }
  }

  if (event.endDate) return { matches: dateStr >= event.date && dateStr <= event.endDate, cancelled }
  return { matches: event.date === dateStr, cancelled }
}

function DetailSection({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '14px 14px 12px', borderRadius: 18, border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
      <div style={{ fontSize: 12, fontWeight: 900, color, letterSpacing: 0.2, marginBottom: 9 }}>{title}</div>
      {children}
    </div>
  )
}

export function CalendarCompactDayDetail() {
  const { user } = useAuth()
  const {
    children,
    selectedChildId,
    selectedCalendarDate,
    setSelectedCalendarDate,
    setCurrentMonth,
    pattern,
    overrides,
    specialPeriods,
    notes,
    events,
    requests,
    collaboratorAssignments,
    availabilityBlocks,
  } = useAppStore()

  const date = selectedCalendarDate || new Date().toISOString().slice(0, 10)
  const child = useMemo(() => children.find(item => item.id === selectedChildId) ?? null, [children, selectedChildId])
  const [menuOpen, setMenuOpen] = useState(false)
  const [requestModalOpen, setRequestModalOpen] = useState(false)
  const [collaboratorModalOpen, setCollaboratorModalOpen] = useState(false)
  const [eventActionLoading, setEventActionLoading] = useState<string | null>(null)

  const selectedParentInfo = useMemo(() => {
    if (!child || !pattern || !date) return null
    const parentId = getParentForDate(new Date(date + 'T12:00:00'), pattern, overrides, child, specialPeriods)
    if (!parentId) return null
    return {
      parentId,
      name: child.parentNames?.[parentId] ?? 'Progenitor',
      color: child.parentColors?.[parentId] ?? '#6B7280',
      isMe: parentId === user?.uid,
    }
  }, [child, date, pattern, overrides, specialPeriods, user?.uid])

  const isParentForSelectedChild = !!child && !!user?.uid && child.parents.includes(user.uid)
  const canAssignCollaborator = !!(isParentForSelectedChild && selectedParentInfo?.isMe && (child?.collaborators?.length || 0) > 0)
  const selectedEvents = useMemo(() => events.map(event => ({ event, ...getEventOccurrenceState(event, date) })).filter(item => item.matches), [events, date])
  const selectedRequests = useMemo(() => requests.filter(request => (request.type === 'single' && request.date === date) || (request.type === 'range' && request.startDate && request.endDate && date >= request.startDate && date <= request.endDate)), [requests, date])
  const selectedCollaboratorAssignments = useMemo(() => collaboratorAssignments.filter(item => item.date === date && item.status !== 'cancelled'), [collaboratorAssignments, date])
  const selectedNotes = useMemo(() => notes.filter(note => noteMatchesDate(note, date)), [notes, date])
  const selectedDayBlocks = useMemo(() => availabilityBlocks.filter(block => blockOverlapsDate(block, date)), [availabilityBlocks, date])
  const selectedOverride = useMemo(() => overrides.find(override => override.date === date) ?? null, [overrides, date])
  const selectedSpecialPeriod = useMemo(() => specialPeriods.find(period => date >= period.startDate && date <= period.endDate) ?? null, [specialPeriods, date])

  const navigateToTarget = (detail: any) => {
    if (typeof window === 'undefined' || !isParentForSelectedChild) return
    setSelectedCalendarDate(date)
    setCurrentMonth(new Date(date + 'T12:00:00'))
    window.dispatchEvent(new CustomEvent('custodia:navigate', { detail }))
  }

  const openEvent = () => {
    setMenuOpen(false)
    navigateToTarget({ tab: 'events', childId: child?.id, date, openComposer: 'event' })
  }

  const openNote = () => {
    setMenuOpen(false)
    navigateToTarget({ tab: 'notes', childId: child?.id, date, openComposer: 'note' })
  }

  const openChange = () => {
    setMenuOpen(false)
    setSelectedCalendarDate(date)
    setRequestModalOpen(true)
  }

  const openCollaborator = () => {
    setMenuOpen(false)
    if (canAssignCollaborator) setCollaboratorModalOpen(true)
  }

  const handleToggleOccurrence = async (eventId: string, isCancelled: boolean) => {
    if (!date || !isParentForSelectedChild) return
    setEventActionLoading(eventId)
    try {
      if (isCancelled) await restoreEventOccurrence(eventId, date)
      else await cancelEventOccurrence(eventId, date)
    } finally {
      setEventActionLoading(null)
    }
  }

  if (!child) return null

  return (
    <>
      <section data-custodia-compact-day-detail="true" className="card" style={{ marginTop: 16, padding: 18, borderRadius: 24, background: 'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-soft) 100%)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 7 }}>Vista del día</div>
            <div style={{ fontSize: 22, fontWeight: 950, color: 'var(--text-strong)', letterSpacing: -0.5 }}>{formatDate(date)}</div>
            {selectedParentInfo ? (
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 7 }}>Corresponde a <strong style={{ color: selectedParentInfo.color }}>{selectedParentInfo.name}</strong>{selectedParentInfo.isMe ? ' (tú)' : ''}</div>
            ) : null}
          </div>

          {isParentForSelectedChild ? (
            <button
              type="button"
              aria-label="Abrir acciones rápidas del día"
              onClick={() => setMenuOpen(true)}
              style={{ width: 54, height: 54, borderRadius: 999, border: '1px solid rgba(59,130,246,0.22)', background: 'linear-gradient(180deg, rgba(59,130,246,0.14) 0%, rgba(37,99,235,0.22) 100%)', color: '#3B82F6', fontSize: 30, fontWeight: 800, lineHeight: 1, cursor: 'pointer', boxShadow: '0 14px 30px rgba(59,130,246,0.16)', flexShrink: 0 }}
            >
              +
            </button>
          ) : null}
        </div>
      </section>

      {menuOpen ? (
        <>
          <div
            aria-hidden="true"
            onClick={() => setMenuOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 9800, background: 'rgba(15,23,42,0.18)' }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Añadir al día"
            style={{ position: 'fixed', left: 14, right: 14, bottom: 'calc(env(safe-area-inset-bottom) + 104px)', zIndex: 9801, maxWidth: 560, margin: '0 auto', padding: 12, borderRadius: 26, border: '1px solid var(--border-hover)', background: 'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-soft) 100%)', boxShadow: '0 24px 56px rgba(15,23,42,0.24)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '4px 4px 10px' }}>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 900, letterSpacing: 0.45, textTransform: 'uppercase' }}>Añadir al día</div>
                <div style={{ color: 'var(--text-strong)', fontSize: 15, fontWeight: 950, marginTop: 2 }}>{formatDate(date)}</div>
              </div>
              <button
                type="button"
                aria-label="Cerrar acciones rápidas"
                onClick={() => setMenuOpen(false)}
                style={{ width: 36, height: 36, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 18, fontWeight: 900, cursor: 'pointer' }}
              >
                ×
              </button>
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <QuickAction icon="📌" label="Nuevo evento" hint="Cita, colegio, actividad" color="#10b981" onClick={openEvent} />
              <QuickAction icon="🔄" label="Nuevo cambio" hint="Solicitud puntual" color="#60a5fa" onClick={openChange} />
              {canAssignCollaborator ? <QuickAction icon="🤝" label="Nueva asignación" hint="Familiar o cuidador" color="#8B5CF6" onClick={openCollaborator} /> : null}
              <QuickAction icon="📝" label="Nueva nota" hint="Aviso u observación" color="#f59e0b" onClick={openNote} />
            </div>
          </div>
        </>
      ) : null}

      <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
        {selectedOverride ? (
          <DetailSection title="Cambio aprobado" color="#fbbf24">
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{selectedOverride.reason || 'Sin observaciones'}</div>
          </DetailSection>
        ) : null}

        {selectedSpecialPeriod ? (
          <DetailSection title={selectedSpecialPeriod.label === 'otro' ? (selectedSpecialPeriod.customLabel ?? 'Período especial') : PERIOD_LABELS[selectedSpecialPeriod.label]} color="var(--text-strong)">
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Periodo especial activo este día</div>
          </DetailSection>
        ) : null}

        {selectedEvents.length > 0 ? (
          <DetailSection title="Eventos" color="#10b981">
            <div style={{ display: 'grid', gap: 8 }}>
              {selectedEvents.map(({ event, cancelled }) => (
                <DayEventItem
                  key={event.id}
                  event={event}
                  cancelled={cancelled}
                  canManageOccurrence={!!(isParentForSelectedChild && event.recurrence && event.recurrence !== 'none' && event.createdBy === user?.uid)}
                  eventActionLoading={eventActionLoading}
                  onNavigate={() => navigateToTarget({ tab: 'events', childId: event.childId, date: event.date, focusTargetId: `event-${event.id}` })}
                  onToggleOccurrence={() => handleToggleOccurrence(event.id, cancelled)}
                  documentCount={Array.isArray(event.documentIds) ? event.documentIds.length : 0}
                />
              ))}
            </div>
          </DetailSection>
        ) : null}

        {selectedRequests.length > 0 || selectedDayBlocks.length > 0 ? (
          <DetailSection title="Solicitudes de cambio" color="#60a5fa">
            <div style={{ display: 'grid', gap: 8 }}>
              {selectedDayBlocks.map(block => (
                <div key={block.id} style={{ padding: '10px 12px', borderRadius: 14, background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.22)' }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--text-strong)' }}>{block.userName}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>{formatAvailabilityBlockLabel(block)}</div>
                  {block.note ? <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{block.note}</div> : null}
                </div>
              ))}
              {selectedRequests.map(request => (
                <button key={request.id} onClick={() => navigateToTarget({ tab: 'requests', childId: request.childId, date: request.date || request.startDate || date, focusTargetId: `request-${request.id}` })} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 14, background: 'rgba(59,130,246,0.10)', border: '1px solid rgba(59,130,246,0.2)', cursor: isParentForSelectedChild ? 'pointer' : 'default' }}>
                  <div style={{ fontSize: 13, color: 'var(--text-strong)', fontWeight: 800 }}>{request.fromParentName}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>{request.reason}</div>
                  <div style={{ fontSize: 11, color: request.status === 'pending' ? '#fbbf24' : request.status === 'accepted' ? '#10b981' : request.status === 'cancelled' ? 'var(--text-muted)' : '#f87171', marginTop: 6, fontWeight: 800 }}>{String(request.status).toUpperCase()}</div>
                </button>
              ))}
            </div>
          </DetailSection>
        ) : null}

        {selectedCollaboratorAssignments.length > 0 ? (
          <DetailSection title="Colaboradores" color="#8B5CF6">
            <div style={{ display: 'grid', gap: 8 }}>
              {selectedCollaboratorAssignments.map(item => (
                <div key={item.id} style={{ padding: '10px 12px', borderRadius: 14, background: 'rgba(139,92,246,0.10)', border: '1px solid rgba(139,92,246,0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontSize: 13, color: 'var(--text-strong)', fontWeight: 800 }}>{item.collaboratorName}</div>
                    <div style={{ fontSize: 11, color: item.status === 'accepted' ? '#10b981' : item.status === 'rejected' ? '#ef4444' : '#8B5CF6', fontWeight: 800 }}>{String(item.status).toUpperCase()}</div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>{item.type === 'partial_slot' && item.startTime && item.endTime ? `${item.startTime}-${item.endTime}` : 'Día completo'}</div>
                  {item.notes ? <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>{item.notes}</div> : null}
                </div>
              ))}
            </div>
          </DetailSection>
        ) : null}

        {selectedNotes.length > 0 ? (
          <DetailSection title="Notas" color="#f59e0b">
            <div style={{ display: 'grid', gap: 8 }}>
              {selectedNotes.map(note => (
                <button key={note.id} onClick={() => navigateToTarget({ tab: 'notes', childId: note.childId, date: note.date || note.startDate, focusTargetId: `note-${note.id}` })} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 14, background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.2)', cursor: isParentForSelectedChild ? 'pointer' : 'default' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 800 }}>{String(note.tag).toUpperCase()}</div>
                    {Array.isArray(note.documentIds) && note.documentIds.length > 0 ? <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 800 }}>📎 ({note.documentIds.length})</div> : null}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-strong)', marginTop: 4 }}>{note.text}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>Por {note.createdByName}{note.mentionOther ? ' · notifica al otro progenitor' : ''}</div>
                </button>
              ))}
            </div>
          </DetailSection>
        ) : null}
      </div>

      <RequestModal open={requestModalOpen} onClose={() => setRequestModalOpen(false)} initialDate={date} />
      <CollaboratorAssignmentModal open={collaboratorModalOpen} onClose={() => setCollaboratorModalOpen(false)} initialDate={date} baseParentId={selectedParentInfo?.parentId ?? null} />
    </>
  )
}

function QuickAction({ icon, label, hint, color, onClick }: { icon: string; label: string; hint: string; color: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, textAlign: 'left', padding: '12px 11px', borderRadius: 15, border: '1px solid transparent', background: 'var(--bg-card)', color: 'var(--text-strong)', cursor: 'pointer' }}>
      <span style={{ width: 36, height: 36, borderRadius: 999, background: `${color}18`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>{icon}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 13, fontWeight: 950, color }}>{label}</span>
        <span style={{ display: 'block', fontSize: 11, fontWeight: 750, color: 'var(--text-muted)', marginTop: 2 }}>{hint}</span>
      </span>
    </button>
  )
}
