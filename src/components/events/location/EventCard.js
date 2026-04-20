'use client'
import { useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { deleteEvent, setOverride, updateEvent } from '@/lib/db'
import { formatDate } from '@/lib/utils'
import {
  CAT_CONFIG,
  buildNavigationLinks,
  downloadICSFile,
  listDates,
  notifyEventAssignmentPending,
  notifyEventAssignmentResponse,
} from './shared'
import { LocationActions } from './LocationActions'

export function EventCard({ event, onEdit }) {
  const { user } = useAuth()
  const { children, selectedChildId } = useAppStore()
  const [calendarLoading, setCalendarLoading] = useState(false)
  const child = useMemo(() => children.find(c => c.id === selectedChildId) ?? null, [children, selectedChildId])

  const cat = CAT_CONFIG[event.category]
  const today = new Date().toISOString().slice(0, 10)
  const isPast = event.date < today
  const isToday = event.date === today
  const categoryLabel = event.category === 'otro' ? event.customCategory || cat.label : cat.label
  const recurrenceLabel = event.recurrence === 'weekly' ? 'Semanal' : event.recurrence === 'monthly' ? 'Mensual' : ''
  const assignedName = event.assignedParentId && child ? child.parentNames?.[event.assignedParentId] : null
  const canRespondAssignment = event.assignmentStatus === 'pending' && user?.uid === event.assignmentRequestToParentId
  const canRequestAssignment = !!child && child.parents.length >= 2 && event.assignmentStatus !== 'pending'
  const navLinks = buildNavigationLinks(event)

  const requestAssignment = async targetParentId => {
    if (!user || !child) return
    const otherParentId = child.parents.find(pid => pid !== user.uid)
    if (!otherParentId) return
    await updateEvent(event.id, {
      assignedParentId: targetParentId,
      assignmentStatus: 'pending',
      assignmentRequestedBy: user.uid,
      assignmentRequestedByName: user.displayName || user.email || 'Progenitor',
      assignmentRequestToParentId: otherParentId,
    })
    await notifyEventAssignmentPending({
      toUserId: otherParentId,
      childId: event.childId,
      childName: child.name,
      eventTitle: event.title,
      dateKey: event.date,
      requesterName: user.displayName || user.email || 'Progenitor',
    })
  }

  const respondAssignment = async accept => {
    if (!user || !child) return
    if (!accept) {
      await updateEvent(event.id, { assignmentStatus: 'rejected' })
      if (event.assignmentRequestedBy) {
        await notifyEventAssignmentResponse({
          toUserId: event.assignmentRequestedBy,
          childId: event.childId,
          childName: child.name,
          eventTitle: event.title,
          dateKey: event.date,
          accepted: false,
          responderName: user.displayName || user.email || 'Progenitor',
        })
      }
      return
    }

    await updateEvent(event.id, { assignmentStatus: 'accepted' })
    if (event.allDay && event.assignedParentId) {
      for (const date of listDates(event.date, event.endDate)) {
        await setOverride({ childId: event.childId, date, parentId: event.assignedParentId, reason: `Asignación por evento: ${event.title}`, createdBy: user.uid })
      }
    }
    if (event.assignmentRequestedBy) {
      await notifyEventAssignmentResponse({
        toUserId: event.assignmentRequestedBy,
        childId: event.childId,
        childName: child.name,
        eventTitle: event.title,
        dateKey: event.date,
        accepted: true,
        responderName: user.displayName || user.email || 'Progenitor',
      })
    }
  }

  const addToCalendar = async () => {
    setCalendarLoading(true)
    try { await downloadICSFile(event) } finally { setCalendarLoading(false) }
  }

  return (
    <div className="card" style={{ marginBottom: 10, opacity: isPast ? 0.7 : 1, border: `1px solid ${cat.color}33`, borderRadius: 22, padding: 16, background: `linear-gradient(180deg, ${cat.color}10 0%, var(--bg-card) 30%, var(--bg-soft) 100%)` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: `${cat.color}22`, border: `1px solid ${cat.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21, flexShrink: 0 }}>{cat.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--text-strong)', fontSize: 14, fontWeight: 800 }}>{event.title}</span>
            {isToday && <span style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981', fontSize: 10, fontWeight: 800, padding: '4px 8px', borderRadius: 999 }}>Hoy</span>}
            <span style={{ background: `${cat.color}22`, color: cat.color, fontSize: 10, fontWeight: 800, padding: '4px 8px', borderRadius: 999 }}>{categoryLabel}</span>
            {recurrenceLabel && <span style={{ background: 'rgba(139,92,246,0.18)', color: '#a78bfa', fontSize: 10, fontWeight: 800, padding: '4px 8px', borderRadius: 999 }}>{recurrenceLabel}</span>}
            {event.reminderEnabled && <span style={{ background: 'rgba(59,130,246,0.18)', color: '#93c5fd', fontSize: 10, fontWeight: 800, padding: '4px 8px', borderRadius: 999 }}>⏰ {event.reminderDaysBefore ?? 0}d</span>}
            {event.assignmentStatus === 'pending' && assignedName && <span style={{ background: 'rgba(59,130,246,0.18)', color: '#93c5fd', fontSize: 10, fontWeight: 800, padding: '4px 8px', borderRadius: 999 }}>Pendiente para {assignedName}</span>}
            {event.assignmentStatus === 'accepted' && assignedName && <span style={{ background: 'rgba(16,185,129,0.18)', color: '#6ee7b7', fontSize: 10, fontWeight: 800, padding: '4px 8px', borderRadius: 999 }}>Asignado a {assignedName}</span>}
          </div>

          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
            {formatDate(event.date)}{event.endDate ? ` → ${formatDate(event.endDate)}` : ''}{event.time ? ` · ${event.time}` : event.allDay ? ' · Todo el día' : ''}
          </div>

          <LocationActions event={event} navLinks={navLinks} />
          {event.notes && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, lineHeight: 1.5 }}>{event.notes}</div>}
          {event.reminderEnabled && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>Aviso: {event.reminderDaysBefore === 0 ? 'el mismo día' : `${event.reminderDaysBefore} día(s) antes`} · {event.reminderAudience === 'both' ? 'ambos progenitores' : 'solo tú'}</div>}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={addToCalendar} disabled={calendarLoading} style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.24)', borderRadius: 10, color: '#93c5fd', fontSize: 11, fontWeight: 800, padding: '7px 10px', cursor: 'pointer' }}>{calendarLoading ? 'Preparando...' : 'Añadir al calendario'}</button>
            {event.createdBy === user?.uid && <button onClick={onEdit} style={{ background: 'var(--bg-soft)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 11, fontWeight: 800, padding: '7px 10px', borderRadius: 10 }}>Editar</button>}
            {event.createdBy === user?.uid && <button onClick={() => deleteEvent(event.id)} style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.18)', color: '#fca5a5', cursor: 'pointer', fontSize: 11, fontWeight: 800, padding: '7px 10px', borderRadius: 10 }}>Eliminar</button>}
          </div>

          {child && canRequestAssignment && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>{child.parents.map(pid => <button key={pid} onClick={() => requestAssignment(pid)} style={{ background: 'var(--bg-soft)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-secondary)', fontSize: 11, fontWeight: 800, padding: '6px 9px', cursor: 'pointer' }}>Asignar a {child.parentNames?.[pid] ?? 'Progenitor'}</button>)}</div>}

          {canRespondAssignment && <div style={{ display: 'flex', gap: 8, marginTop: 8 }}><button onClick={() => respondAssignment(false)} style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, color: '#fca5a5', fontSize: 11, fontWeight: 800, padding: '7px 10px', cursor: 'pointer' }}>Rechazar</button><button onClick={() => respondAssignment(true)} style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 10, color: '#6ee7b7', fontSize: 11, fontWeight: 800, padding: '7px 10px', cursor: 'pointer' }}>Aceptar</button></div>}
        </div>
      </div>
    </div>
  )
}
