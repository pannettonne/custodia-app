'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { format, eachDayOfInterval, parseISO } from 'date-fns'
import { useAppStore } from '@/store/app'
import { useAuth } from '@/lib/auth-context'
import {
  respondToRequest,
  setOverride,
  cancelRequest,
  deleteRequest,
  updateEvent,
  createNotification,
  clearPendingEventAssignment,
} from '@/lib/db'
import {
  cancelCollaboratorAssignment,
  respondToCollaboratorAssignment,
} from '@/lib/collaborator-assignments-db'
import { showToast } from '@/lib/toast'
import { formatDate, getParentForDate } from '@/lib/utils'
import type { ChangeRequest, CollaboratorAssignment, SchoolEvent } from '@/types'

function listDates(startDate: string, endDate?: string) {
  const result: string[] = []
  const start = new Date(`${startDate}T12:00:00`)
  const end = new Date(`${endDate || startDate}T12:00:00`)
  let cur = new Date(start)
  while (cur <= end) {
    result.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  return result
}

function compactText(value?: string, max = 110) {
  const text = (value || '').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  return text.length > max ? `${text.slice(0, max - 3)}...` : text
}

function badgeStyle(tone: 'warning' | 'success' | 'danger' | 'muted' | 'violet' | 'info') {
  if (tone === 'warning') return { background: 'rgba(245,158,11,0.14)', color: '#f59e0b' }
  if (tone === 'success') return { background: 'rgba(16,185,129,0.14)', color: '#10b981' }
  if (tone === 'danger') return { background: 'rgba(239,68,68,0.14)', color: '#ef4444' }
  if (tone === 'violet') return { background: 'rgba(139,92,246,0.14)', color: '#8B5CF6' }
  if (tone === 'info') return { background: 'rgba(59,130,246,0.14)', color: '#60a5fa' }
  return { background: 'var(--bg-soft)', color: 'var(--text-muted)' }
}

function cardPalette(tone: 'warning' | 'success' | 'danger' | 'muted' | 'violet' | 'info') {
  if (tone === 'warning') return { border: 'rgba(245,158,11,0.28)', background: 'linear-gradient(180deg, rgba(245,158,11,0.10) 0%, var(--bg-card) 36%, var(--bg-soft) 100%)' }
  if (tone === 'success') return { border: 'rgba(16,185,129,0.26)', background: 'linear-gradient(180deg, rgba(16,185,129,0.10) 0%, var(--bg-card) 36%, var(--bg-soft) 100%)' }
  if (tone === 'danger') return { border: 'rgba(239,68,68,0.24)', background: 'linear-gradient(180deg, rgba(239,68,68,0.10) 0%, var(--bg-card) 36%, var(--bg-soft) 100%)' }
  if (tone === 'violet') return { border: 'rgba(139,92,246,0.24)', background: 'linear-gradient(180deg, rgba(139,92,246,0.10) 0%, var(--bg-card) 36%, var(--bg-soft) 100%)' }
  return { border: 'rgba(59,130,246,0.24)', background: 'linear-gradient(180deg, rgba(59,130,246,0.10) 0%, var(--bg-card) 36%, var(--bg-soft) 100%)' }
}

function actionButtonStyle(tone: 'neutral' | 'success' | 'danger') {
  if (tone === 'success') return { background: 'rgba(16,185,129,0.14)', border: '1px solid rgba(16,185,129,0.24)', color: '#6ee7b7' }
  if (tone === 'danger') return { background: 'rgba(239,68,68,0.14)', border: '1px solid rgba(239,68,68,0.24)', color: '#fca5a5' }
  return { background: 'var(--bg-soft)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }
}

function ActionButton({
  children,
  onClick,
  tone = 'neutral',
}: {
  children: any
  onClick: () => void
  tone?: 'neutral' | 'success' | 'danger'
}) {
  return (
    <button
      onClick={onClick}
      className="req-action-btn"
      style={{
        padding: '7px 10px',
        borderRadius: 10,
        fontSize: 11,
        fontWeight: 800,
        ...actionButtonStyle(tone),
      }}
    >
      {children}
    </button>
  )
}

function Section({
  title,
  count,
  children,
  collapsible,
  open,
  onToggle,
  tone = 'muted',
}: {
  title: string
  count: number
  children: any
  collapsible?: boolean
  open?: boolean
  onToggle?: () => void
  tone?: 'warning' | 'success' | 'danger' | 'muted' | 'violet' | 'info'
}) {
  if (count === 0) return null
  const badge = badgeStyle(tone)

  return (
    <div style={{ marginBottom: 14 }}>
      <button
        onClick={collapsible ? onToggle : undefined}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'none',
          border: 'none',
          padding: '0 0 10px 0',
          cursor: collapsible ? 'pointer' : 'default',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="section-title" style={{ margin: 0, color: 'var(--text-strong)' }}>{title}</div>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 22,
              height: 22,
              padding: '0 7px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 800,
              ...badge,
            }}
          >
            {count}
          </span>
        </div>
        {collapsible ? <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{open ? 'Ocultar' : 'Mostrar'}</span> : null}
      </button>
      {(!collapsible || open) ? children : null}
    </div>
  )
}

export function RequestsList({ focusTargetId, focusSeq }: { focusTargetId?: string; focusSeq?: number } = {}) {
  const { user } = useAuth()
  const {
    requests,
    collaboratorAssignments,
    events,
    children,
    selectedChildId,
    pattern,
    overrides,
    specialPeriods,
  } = useAppStore()
  const child = useMemo(() => children.find(c => c.id === selectedChildId) ?? null, [children, selectedChildId])
  const isParentForSelectedChild = !!child && !!user?.uid && child.parents.includes(user.uid)
  const isCollaboratorForSelectedChild = !!child && !!user?.uid && !!child.collaborators?.includes(user.uid)
  const [showResolved, setShowResolved] = useState(false)
  const [showCancelled, setShowCancelled] = useState(false)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const grouped = useMemo(() => {
    if (!user) {
      return {
        incomingPending: [] as ChangeRequest[],
        outgoingPending: [] as ChangeRequest[],
        incomingEventAssignments: [] as SchoolEvent[],
        outgoingEventAssignments: [] as SchoolEvent[],
        incomingCollaboratorAssignments: [] as CollaboratorAssignment[],
        outgoingCollaboratorAssignments: [] as CollaboratorAssignment[],
        resolved: [] as ChangeRequest[],
        cancelled: [] as ChangeRequest[],
        resolvedCollaboratorAssignments: [] as CollaboratorAssignment[],
        cancelledCollaboratorAssignments: [] as CollaboratorAssignment[],
      }
    }

    const incomingPending = isParentForSelectedChild
      ? requests.filter(r => r.toParentId === user.uid && r.status === 'pending')
      : []
    const outgoingPending = isParentForSelectedChild
      ? requests.filter(r => r.fromParentId === user.uid && r.status === 'pending')
      : []
    const incomingEventAssignments = isParentForSelectedChild
      ? events.filter(e => e.assignmentStatus === 'pending' && e.assignmentRequestToParentId === user.uid)
      : []
    const outgoingEventAssignments = isParentForSelectedChild
      ? events.filter(e => e.assignmentStatus === 'pending' && e.assignmentRequestedBy === user.uid)
      : []

    const collaboratorScoped = collaboratorAssignments.filter(a => {
      if (isCollaboratorForSelectedChild) return a.collaboratorId === user.uid
      if (isParentForSelectedChild) return a.createdByParentId === user.uid || a.collaboratorId === user.uid
      return false
    })

    return {
      incomingPending,
      outgoingPending,
      incomingEventAssignments,
      outgoingEventAssignments,
      incomingCollaboratorAssignments: collaboratorScoped.filter(a => a.status === 'pending' && a.collaboratorId === user.uid),
      outgoingCollaboratorAssignments: collaboratorScoped.filter(a => a.status === 'pending' && a.createdByParentId === user.uid),
      resolved: isParentForSelectedChild ? requests.filter(r => ['accepted', 'rejected'].includes(r.status)) : [],
      cancelled: isParentForSelectedChild ? requests.filter(r => r.status === 'cancelled') : [],
      resolvedCollaboratorAssignments: collaboratorScoped.filter(a => ['accepted', 'rejected'].includes(a.status)),
      cancelledCollaboratorAssignments: collaboratorScoped.filter(a => a.status === 'cancelled'),
    }
  }, [requests, collaboratorAssignments, events, user?.uid, isParentForSelectedChild, isCollaboratorForSelectedChild])

  useEffect(() => {
    if (!focusTargetId) return

    if (focusTargetId.startsWith('request-')) {
      const matchedResolved = grouped.resolved.some(r => `request-${r.id}` === focusTargetId)
      const matchedCancelled = grouped.cancelled.some(r => `request-${r.id}` === focusTargetId)
      if (matchedResolved && !showResolved) {
        setShowResolved(true)
        return
      }
      if (matchedCancelled && !showCancelled) {
        setShowCancelled(true)
        return
      }
    }

    const target = cardRefs.current[focusTargetId]
    if (!target) return

    const timer = window.setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setHighlightedId(focusTargetId)
    }, 80)
    const clearTimer = window.setTimeout(() => setHighlightedId(current => current === focusTargetId ? null : current), 2600)
    return () => {
      window.clearTimeout(timer)
      window.clearTimeout(clearTimer)
    }
  }, [focusTargetId, focusSeq, grouped, showResolved, showCancelled])

  const navigateToTarget = (detail: any) => {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new CustomEvent('custodia:navigate', { detail }))
  }

  const notifyRequester = async (req: ChangeRequest, accepted: boolean) => {
    await createNotification({
      userId: req.fromParentId,
      childId: req.childId,
      childName: child?.name,
      type: 'pending_request',
      title: accepted ? 'Solicitud de cambio aceptada' : 'Solicitud de cambio rechazada',
      body: `${user?.displayName || user?.email || 'El otro progenitor'} ha ${accepted ? 'aceptado' : 'rechazado'} tu solicitud de cambio.`,
      dateKey: `change-request-response:${req.id}:${accepted ? 'accepted' : 'rejected'}`,
    })
  }

  const handleAccept = async (req: ChangeRequest) => {
    if (!child || !user) return
    await respondToRequest(req.id, 'accepted')
    const dates = req.type === 'single'
      ? [req.date!]
      : eachDayOfInterval({ start: parseISO(req.startDate!), end: parseISO(req.endDate!) }).map(d => format(d, 'yyyy-MM-dd'))

    for (const date of dates) {
      const currentOwner = getParentForDate(new Date(`${date}T12:00:00`), pattern, overrides, child, specialPeriods)
      const otherParent = child.parents.find(pid => pid !== currentOwner) ?? req.fromParentId
      const targetParentId = currentOwner === req.fromParentId ? otherParent : req.fromParentId
      await setOverride({ childId: req.childId, date, parentId: targetParentId, reason: req.reason, createdBy: user.uid })
    }

    await notifyRequester(req, true)
  }

  const handleReject = async (req: ChangeRequest) => {
    await respondToRequest(req.id, 'rejected')
    await notifyRequester(req, false)
  }

  const handleCancelOwn = async (req: ChangeRequest) => {
    await cancelRequest(req.id)
    await createNotification({
      userId: req.toParentId,
      childId: req.childId,
      childName: child?.name,
      type: 'pending_request',
      title: 'Solicitud de cambio cancelada',
      body: `${user?.displayName || user?.email || 'El otro progenitor'} ha cancelado una solicitud de cambio pendiente.`,
      dateKey: `change-request-cancel:${req.id}`,
    })
    showToast({ message: 'Solicitud cancelada.', tone: 'success' })
  }

  const respondEventAssignment = async (event: SchoolEvent, accept: boolean) => {
    if (!user || !child) return

    if (!accept) {
      await updateEvent(event.id, { assignmentStatus: 'rejected' })
      if (event.assignmentRequestedBy) {
        await createNotification({
          userId: event.assignmentRequestedBy,
          childId: event.childId,
          childName: child.name,
          type: 'event_assignment_response',
          title: 'Asignación de evento rechazada',
          body: `${user.displayName || user.email || 'Progenitor'} ha rechazado la asignación del evento “${event.title}”.`,
          dateKey: event.date,
        })
      }
      return
    }

    await updateEvent(event.id, { assignmentStatus: 'accepted' })
    if (event.allDay && event.assignedParentId) {
      for (const date of listDates(event.date, event.endDate)) {
        await setOverride({
          childId: event.childId,
          date,
          parentId: event.assignedParentId,
          reason: `Asignación por evento: ${event.title}`,
          createdBy: user.uid,
        })
      }
    }

    if (event.assignmentRequestedBy) {
      await createNotification({
        userId: event.assignmentRequestedBy,
        childId: event.childId,
        childName: child.name,
        type: 'event_assignment_response',
        title: 'Asignación de evento aceptada',
        body: `${user.displayName || user.email || 'Progenitor'} ha aceptado la asignación del evento “${event.title}”.`,
        dateKey: event.date,
      })
    }
  }

  const cancelOutgoingEventAssignment = async (event: SchoolEvent) => {
    if (!user || !child || !event.assignmentRequestToParentId) return
    await clearPendingEventAssignment(event.id)
    await createNotification({
      userId: event.assignmentRequestToParentId,
      childId: event.childId,
      childName: child.name,
      type: 'event_assignment_response',
      title: 'Asignación de evento cancelada',
      body: `${user.displayName || user.email || 'Progenitor'} ha cancelado la asignación pendiente del evento “${event.title}”.`,
      dateKey: `event-assignment-cancel:${event.id}`,
    })
    showToast({ message: 'Asignación cancelada.', tone: 'success' })
  }

  const respondCollaborator = async (assignment: CollaboratorAssignment, accept: boolean) => {
    if (!user || !child) return
    await respondToCollaboratorAssignment(assignment.id, accept ? 'accepted' : 'rejected')
    await createNotification({
      userId: assignment.createdByParentId,
      childId: assignment.childId,
      childName: child.name,
      type: 'event_assignment_response',
      title: accept ? 'Asignación a colaborador aceptada' : 'Asignación a colaborador rechazada',
      body: `${user.displayName || user.email || 'Colaborador'} ha ${accept ? 'aceptado' : 'rechazado'} la asignación de ${formatDate(assignment.date)}.`,
      dateKey: `collaborator-assignment-response:${assignment.id}`,
      targetTab: 'requests',
      targetDate: assignment.date,
    })
    showToast({ message: accept ? 'Asignación aceptada.' : 'Asignación rechazada.', tone: 'success' })
  }

  const cancelOutgoingCollaborator = async (assignment: CollaboratorAssignment) => {
    if (!user || !child) return
    await cancelCollaboratorAssignment(assignment.id)
    await createNotification({
      userId: assignment.collaboratorId,
      childId: assignment.childId,
      childName: child.name,
      type: 'event_assignment_response',
      title: 'Asignación a colaborador cancelada',
      body: `${user.displayName || user.email || 'Progenitor'} ha cancelado la asignación de ${formatDate(assignment.date)}.`,
      dateKey: `collaborator-assignment-cancel:${assignment.id}`,
      targetTab: 'requests',
      targetDate: assignment.date,
    })
    showToast({ message: 'Asignación cancelada.', tone: 'success' })
  }

  const hasAnyContent =
    requests.length > 0 ||
    collaboratorAssignments.length > 0 ||
    grouped.incomingEventAssignments.length > 0 ||
    grouped.outgoingEventAssignments.length > 0

  if (!hasAnyContent) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">💬</div>
        <div className="empty-state-title">{isCollaboratorForSelectedChild ? 'No hay asignaciones' : 'No hay solicitudes ni asignaciones'}</div>
        <div className="empty-state-sub">{isCollaboratorForSelectedChild ? 'Las asignaciones que te envíen aparecerán aquí' : 'Los cambios y asignaciones aparecerán aquí'}</div>
      </div>
    )
  }

  const ChangeCard = ({ req, isIncoming }: { req: ChangeRequest; isIncoming: boolean }) => {
    const dateText = req.type === 'single' ? formatDate(req.date!) : `${formatDate(req.startDate!)} → ${formatDate(req.endDate!)}`
    const tone = req.status === 'pending' ? 'warning' : req.status === 'accepted' ? 'success' : req.status === 'cancelled' ? 'muted' : 'danger'
    const badgeText = req.status === 'pending' ? 'Pendiente' : req.status === 'accepted' ? 'Aceptada' : req.status === 'cancelled' ? 'Cancelada' : 'Rechazada'
    const palette = cardPalette(tone)
    const badge = badgeStyle(tone)
    const compactReason = compactText(req.reason)

    return (
      <div style={{ background: palette.background, border: `1px solid ${palette.border}`, borderRadius: 22, padding: 14, marginBottom: 10, boxShadow: 'var(--card-shadow)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 5 }}>
              <span style={{ color: 'var(--text-strong)', fontSize: 14, fontWeight: 800 }}>{isIncoming ? `${req.fromParentName} te propone un cambio` : 'Solicitud de cambio enviada'}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 800, ...badge }}>{badgeText}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700 }}>{dateText}</div>
          </div>
          <span style={{ flexShrink: 0, fontSize: 10, color: 'var(--text-muted)', fontWeight: 800, background: 'var(--bg-soft)', border: '1px solid var(--border)', borderRadius: 999, padding: '3px 8px' }}>{req.type === 'single' ? 'Día' : 'Rango'}</span>
        </div>

        {compactReason ? <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45, marginTop: 8 }}>{compactReason}</div> : null}

        {isIncoming && req.status === 'pending' ? (
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <ActionButton tone="danger" onClick={() => handleReject(req)}>Rechazar</ActionButton>
            <ActionButton tone="success" onClick={() => handleAccept(req)}>Aceptar</ActionButton>
          </div>
        ) : null}

        {!isIncoming && req.status === 'pending' ? (
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <ActionButton tone="danger" onClick={() => handleCancelOwn(req)}>Cancelar</ActionButton>
          </div>
        ) : null}

        {req.status === 'cancelled' ? (
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <ActionButton tone="danger" onClick={() => deleteRequest(req.id)}>Eliminar</ActionButton>
          </div>
        ) : null}
      </div>
    )
  }

  const CollaboratorCard = ({ assignment, incoming }: { assignment: CollaboratorAssignment; incoming: boolean }) => {
    const tone = assignment.status === 'accepted' ? 'success' : assignment.status === 'rejected' ? 'danger' : assignment.status === 'cancelled' ? 'muted' : 'violet'
    const badgeText = assignment.status === 'accepted' ? 'Aceptada' : assignment.status === 'rejected' ? 'Rechazada' : assignment.status === 'cancelled' ? 'Cancelada' : 'Pendiente'
    const palette = cardPalette(tone)
    const badge = badgeStyle(tone)
    const slotText = assignment.type === 'partial_slot' && assignment.startTime && assignment.endTime ? `${assignment.startTime}-${assignment.endTime}` : 'Día completo'
    const compactNotes = compactText(assignment.notes)

    return (
      <div style={{ background: palette.background, border: `1px solid ${palette.border}`, borderRadius: 22, padding: 14, marginBottom: 10, boxShadow: 'var(--card-shadow)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 5 }}>
              <span style={{ color: 'var(--text-strong)', fontSize: 14, fontWeight: 800 }}>{incoming ? `${assignment.createdByParentName} te asigna este apoyo` : `Has asignado a ${assignment.collaboratorName}`}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 800, ...badge }}>{badgeText}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700 }}>{formatDate(assignment.date)} · {slotText}</div>
          </div>
          <span style={{ flexShrink: 0, fontSize: 10, color: 'var(--text-muted)', fontWeight: 800, background: 'var(--bg-soft)', border: '1px solid var(--border)', borderRadius: 999, padding: '3px 8px' }}>{assignment.type === 'partial_slot' ? 'Tramo' : 'Día'}</span>
        </div>

        {compactNotes ? <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45, marginTop: 8 }}>{compactNotes}</div> : null}

        {incoming && assignment.status === 'pending' ? (
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <ActionButton tone="danger" onClick={() => respondCollaborator(assignment, false)}>Rechazar</ActionButton>
            <ActionButton tone="success" onClick={() => respondCollaborator(assignment, true)}>Aceptar</ActionButton>
          </div>
        ) : null}

        {!incoming && assignment.status === 'pending' ? (
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <ActionButton tone="danger" onClick={() => cancelOutgoingCollaborator(assignment)}>Cancelar</ActionButton>
          </div>
        ) : null}
      </div>
    )
  }

  const EventAssignmentCard = ({ event, incoming }: { event: SchoolEvent; incoming: boolean }) => {
    const assignedName = event.assignedParentId && child ? child.parentNames?.[event.assignedParentId] : 'el otro progenitor'
    const openEvent = () => navigateToTarget({ tab: 'events', childId: event.childId, date: event.date, focusTargetId: `event-${event.id}` })
    const compactNotes = compactText(event.notes)
    const dateText = `${formatDate(event.date)}${event.endDate ? ` → ${formatDate(event.endDate)}` : ''}`
    const timeText = event.allDay ? 'Todo el día' : event.time && event.endTime ? `${event.time}-${event.endTime}` : event.time || 'Sin hora'
    const palette = cardPalette('info')
    const badge = badgeStyle('info')

    return (
      <div style={{ background: palette.background, border: `1px solid ${palette.border}`, borderRadius: 22, padding: 14, marginBottom: 10, boxShadow: 'var(--card-shadow)' }}>
        <button onClick={openEvent} style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 5 }}>
                <span style={{ color: 'var(--text-strong)', fontSize: 14, fontWeight: 800 }}>{incoming ? `${event.assignmentRequestedByName || 'El otro progenitor'} quiere asignarte este evento` : `Has pedido asignar este evento a ${assignedName}`}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 800, ...badge }}>Pendiente</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700 }}>{event.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{dateText} · {timeText}</div>
            </div>
          </div>
          {compactNotes ? <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45, marginTop: 8 }}>{compactNotes}</div> : null}
        </button>

        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <ActionButton onClick={openEvent}>Abrir</ActionButton>
          {incoming ? (
            <>
              <ActionButton tone="danger" onClick={() => respondEventAssignment(event, false)}>Rechazar</ActionButton>
              <ActionButton tone="success" onClick={() => respondEventAssignment(event, true)}>Aceptar</ActionButton>
            </>
          ) : (
            <ActionButton tone="danger" onClick={() => cancelOutgoingEventAssignment(event)}>Cancelar</ActionButton>
          )}
        </div>
      </div>
    )
  }

  const renderRequestCard = (req: ChangeRequest, isIncoming: boolean) => {
    const searchId = `request-${req.id}`
    return (
      <div
        key={req.id}
        ref={el => { cardRefs.current[searchId] = el }}
        style={highlightedId === searchId ? { borderRadius: 22, boxShadow: '0 0 0 2px rgba(245,158,11,0.45), 0 18px 40px rgba(245,158,11,0.14)', transition: 'box-shadow 0.2s ease' } : undefined}
      >
        <ChangeCard req={req} isIncoming={isIncoming} />
      </div>
    )
  }

  const renderCollaboratorCard = (assignment: CollaboratorAssignment, incoming: boolean) => {
    const searchId = `collaborator-assignment-${assignment.id}`
    return (
      <div
        key={assignment.id}
        ref={el => { cardRefs.current[searchId] = el }}
        style={highlightedId === searchId ? { borderRadius: 22, boxShadow: '0 0 0 2px rgba(139,92,246,0.45), 0 18px 40px rgba(139,92,246,0.14)', transition: 'box-shadow 0.2s ease' } : undefined}
      >
        <CollaboratorCard assignment={assignment} incoming={incoming} />
      </div>
    )
  }

  const renderEventAssignmentCard = (event: SchoolEvent, incoming: boolean) => {
    const searchId = `event-${event.id}`
    return (
      <div
        key={event.id}
        ref={el => { cardRefs.current[searchId] = el }}
        style={highlightedId === searchId ? { borderRadius: 22, boxShadow: '0 0 0 2px rgba(59,130,246,0.45), 0 18px 40px rgba(59,130,246,0.14)', transition: 'box-shadow 0.2s ease' } : undefined}
      >
        <EventAssignmentCard event={event} incoming={incoming} />
      </div>
    )
  }

  if (isCollaboratorForSelectedChild && !isParentForSelectedChild) {
    const collaboratorPending = grouped.incomingCollaboratorAssignments.length
    const collaboratorResolved = grouped.resolvedCollaboratorAssignments.length

    return (
      <div>
        <div className="card" style={{ marginBottom: 16, padding: 16, borderRadius: 20, background: 'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-soft) 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>Coordinación</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div className="page-title" style={{ marginBottom: 0 }}>Asignaciones</div>
                {collaboratorPending > 0 ? <span style={{ ...badgeStyle('violet'), fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 999 }}>{collaboratorPending} pendientes</span> : null}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Solo ves lo que te han enviado como colaborador.</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, auto)', gap: 8 }}>
              <div style={{ ...badgeStyle('violet'), fontSize: 11, fontWeight: 800, padding: '8px 10px', borderRadius: 12 }}>Pendientes: {collaboratorPending}</div>
              <div style={{ ...badgeStyle('success'), fontSize: 11, fontWeight: 800, padding: '8px 10px', borderRadius: 12 }}>Resueltas: {collaboratorResolved}</div>
            </div>
          </div>
        </div>

        <Section title="Pendientes" count={grouped.incomingCollaboratorAssignments.length} tone="violet">
          {grouped.incomingCollaboratorAssignments.map(a => renderCollaboratorCard(a, true))}
        </Section>
        <Section title="Resueltas" count={grouped.resolvedCollaboratorAssignments.length} collapsible open={showResolved} onToggle={() => setShowResolved(v => !v)} tone="success">
          {grouped.resolvedCollaboratorAssignments.map(a => renderCollaboratorCard(a, true))}
        </Section>
        <Section title="Canceladas" count={grouped.cancelledCollaboratorAssignments.length} collapsible open={showCancelled} onToggle={() => setShowCancelled(v => !v)} tone="muted">
          {grouped.cancelledCollaboratorAssignments.map(a => renderCollaboratorCard(a, true))}
        </Section>
      </div>
    )
  }

  const totalPending =
    grouped.incomingPending.length +
    grouped.outgoingPending.length +
    grouped.incomingEventAssignments.length +
    grouped.outgoingEventAssignments.length +
    grouped.incomingCollaboratorAssignments.length +
    grouped.outgoingCollaboratorAssignments.length

  const totalResolved = grouped.resolved.length + grouped.resolvedCollaboratorAssignments.length

  return (
    <div>
      <div className="card" style={{ marginBottom: 16, padding: 16, borderRadius: 20, background: 'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-soft) 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>Coordinación</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div className="page-title" style={{ marginBottom: 0 }}>Cambios</div>
              {totalPending > 0 ? <span style={{ ...badgeStyle('warning'), fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 999 }}>{totalPending} pendientes</span> : null}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Solicitudes y asignaciones con menos ruido y más claridad.</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, auto)', gap: 8 }}>
            <div style={{ ...badgeStyle('warning'), fontSize: 11, fontWeight: 800, padding: '8px 10px', borderRadius: 12 }}>Pendientes: {totalPending}</div>
            <div style={{ ...badgeStyle('success'), fontSize: 11, fontWeight: 800, padding: '8px 10px', borderRadius: 12 }}>Resueltas: {totalResolved}</div>
          </div>
        </div>
      </div>

      <Section title="Solicitudes recibidas" count={grouped.incomingPending.length} tone="warning">
        {grouped.incomingPending.map(req => renderRequestCard(req, true))}
      </Section>
      <Section title="Solicitudes enviadas" count={grouped.outgoingPending.length} tone="warning">
        {grouped.outgoingPending.map(req => renderRequestCard(req, false))}
      </Section>
      <Section title="Eventos pendientes para ti" count={grouped.incomingEventAssignments.length} tone="info">
        {grouped.incomingEventAssignments.map(event => renderEventAssignmentCard(event, true))}
      </Section>
      <Section title="Eventos pendientes enviados" count={grouped.outgoingEventAssignments.length} tone="info">
        {grouped.outgoingEventAssignments.map(event => renderEventAssignmentCard(event, false))}
      </Section>
      <Section title="Asignaciones a colaborador recibidas" count={grouped.incomingCollaboratorAssignments.length} tone="violet">
        {grouped.incomingCollaboratorAssignments.map(a => renderCollaboratorCard(a, true))}
      </Section>
      <Section title="Asignaciones a colaborador enviadas" count={grouped.outgoingCollaboratorAssignments.length} tone="violet">
        {grouped.outgoingCollaboratorAssignments.map(a => renderCollaboratorCard(a, false))}
      </Section>
      <Section title="Resueltas" count={totalResolved} collapsible open={showResolved} onToggle={() => setShowResolved(v => !v)} tone="success">
        {grouped.resolved.map(req => renderRequestCard(req, req.toParentId === user?.uid))}
        {grouped.resolvedCollaboratorAssignments.map(a => renderCollaboratorCard(a, a.collaboratorId === user?.uid))}
      </Section>
      <Section title="Canceladas" count={grouped.cancelled.length + grouped.cancelledCollaboratorAssignments.length} collapsible open={showCancelled} onToggle={() => setShowCancelled(v => !v)} tone="muted">
        {grouped.cancelled.map(req => renderRequestCard(req, req.toParentId === user?.uid))}
        {grouped.cancelledCollaboratorAssignments.map(a => renderCollaboratorCard(a, a.collaboratorId === user?.uid))}
      </Section>
    </div>
  )
}
