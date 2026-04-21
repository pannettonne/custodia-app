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
  const start = new Date(startDate + 'T12:00:00')
  const end = new Date((endDate || startDate) + 'T12:00:00')
  let cur = new Date(start)
  while (cur <= end) {
    result.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  return result
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
    const incomingCollaboratorAssignments = collaboratorScoped.filter(a => a.status === 'pending' && a.collaboratorId === user.uid)
    const outgoingCollaboratorAssignments = collaboratorScoped.filter(a => a.status === 'pending' && a.createdByParentId === user.uid)
    const resolvedCollaboratorAssignments = collaboratorScoped.filter(a => ['accepted', 'rejected'].includes(a.status))
    const cancelledCollaboratorAssignments = collaboratorScoped.filter(a => a.status === 'cancelled')

    const resolved = isParentForSelectedChild
      ? requests.filter(r => ['accepted', 'rejected'].includes(r.status))
      : []
    const cancelled = isParentForSelectedChild
      ? requests.filter(r => r.status === 'cancelled')
      : []

    return {
      incomingPending,
      outgoingPending,
      incomingEventAssignments,
      outgoingEventAssignments,
      incomingCollaboratorAssignments,
      outgoingCollaboratorAssignments,
      resolved,
      cancelled,
      resolvedCollaboratorAssignments,
      cancelledCollaboratorAssignments,
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
      const currentOwner = getParentForDate(new Date(date + 'T12:00:00'), pattern, overrides, child, specialPeriods)
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
        await setOverride({ childId: event.childId, date, parentId: event.assignedParentId, reason: `Asignación por evento: ${event.title}`, createdBy: user.uid })
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

  const Card = ({ req, isIncoming }: { req: ChangeRequest; isIncoming: boolean }) => {
    const dateText = req.type === 'single' ? formatDate(req.date!) : `${formatDate(req.startDate!)} → ${formatDate(req.endDate!)}`
    const palette = req.status === 'pending'
      ? { border: 'rgba(245,158,11,0.30)', badgeBg: 'rgba(245,158,11,0.14)', badgeColor: '#f59e0b', stripe: 'linear-gradient(180deg, rgba(245,158,11,0.10) 0%, var(--bg-card) 30%, var(--bg-soft) 100%)' }
      : req.status === 'accepted'
      ? { border: 'rgba(16,185,129,0.28)', badgeBg: 'rgba(16,185,129,0.14)', badgeColor: '#10b981', stripe: 'linear-gradient(180deg, rgba(16,185,129,0.10) 0%, var(--bg-card) 30%, var(--bg-soft) 100%)' }
      : req.status === 'cancelled'
      ? { border: 'var(--border)', badgeBg: 'var(--bg-soft)', badgeColor: 'var(--text-muted)', stripe: 'linear-gradient(180deg, rgba(148,163,184,0.08) 0%, var(--bg-card) 30%, var(--bg-soft) 100%)' }
      : { border: 'rgba(239,68,68,0.26)', badgeBg: 'rgba(239,68,68,0.14)', badgeColor: '#ef4444', stripe: 'linear-gradient(180deg, rgba(239,68,68,0.10) 0%, var(--bg-card) 30%, var(--bg-soft) 100%)' }
    const badgeText = req.status === 'pending' ? 'Pendiente' : req.status === 'accepted' ? 'Aceptada' : req.status === 'cancelled' ? 'Cancelada' : 'Rechazada'
    return (
      <div style={{ background: palette.stripe, border: `1px solid ${palette.border}`, borderRadius: 22, padding: 16, marginBottom: 10, boxShadow: 'var(--card-shadow)' }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10, marginBottom: 10 }}>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <span style={{ display:'inline-flex', alignItems:'center', width:'fit-content', padding:'5px 10px', borderRadius: 999, background: palette.badgeBg, color: palette.badgeColor, fontSize: 11, fontWeight: 800 }}>{badgeText}</span>
            <div style={{ color:'var(--text-strong)', fontSize: 14, fontWeight: 800 }}>{isIncoming ? req.fromParentName : 'Tú'} pide cambio</div>
          </div>
          <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:700, textAlign:'right' }}>{req.type === 'single' ? 'Día concreto' : 'Rango'}</div>
        </div>
        <div style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize: 12, color:'var(--text-secondary)', background:'var(--bg-soft)', border:'1px solid var(--border)', padding:'7px 10px', borderRadius: 12, marginBottom: 10 }}>
          <span>📅</span>
          <span style={{ fontWeight: 700 }}>{dateText}</span>
        </div>
        <div style={{ fontSize: 12, color:'var(--text-secondary)', lineHeight: 1.5 }}><span style={{ color:'var(--text-muted)' }}>Motivo: </span>{req.reason}</div>
        {isIncoming && req.status === 'pending' && (
          <div style={{ display:'flex', gap:8, marginTop: 14 }}>
            <button className="req-action-btn btn-reject" onClick={() => handleReject(req)}>✕ Rechazar</button>
            <button className="req-action-btn btn-accept" onClick={() => handleAccept(req)}>✓ Aceptar</button>
          </div>
        )}
        {!isIncoming && req.status === 'pending' && (
          <div style={{ display:'flex', gap:8, marginTop: 14 }}>
            <button className="req-action-btn btn-reject" onClick={() => handleCancelOwn(req)}>Cancelar solicitud</button>
          </div>
        )}
        {req.status === 'cancelled' && (
          <div style={{ display:'flex', gap:8, marginTop: 14 }}>
            <button className="req-action-btn btn-reject" onClick={() => deleteRequest(req.id)}>Eliminar</button>
          </div>
        )}
      </div>
    )
  }

  const CollaboratorCard = ({ assignment, incoming }: { assignment: CollaboratorAssignment; incoming: boolean }) => {
    const statusTone = assignment.status === 'accepted' ? '#10b981' : assignment.status === 'rejected' ? '#ef4444' : assignment.status === 'cancelled' ? 'var(--text-muted)' : '#8B5CF6'
    const statusLabel = assignment.status === 'accepted' ? 'Aceptada' : assignment.status === 'rejected' ? 'Rechazada' : assignment.status === 'cancelled' ? 'Cancelada' : 'Pendiente'
    return (
      <div style={{ background:'linear-gradient(180deg, rgba(139,92,246,0.10) 0%, var(--bg-card) 30%, var(--bg-soft) 100%)', border:'1px solid rgba(139,92,246,0.26)', borderRadius:22, padding:16, marginBottom:10, boxShadow:'var(--card-shadow)' }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10, marginBottom:10 }}>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <span style={{ display:'inline-flex', alignItems:'center', width:'fit-content', padding:'5px 10px', borderRadius:999, background:'rgba(139,92,246,0.14)', color:'#8B5CF6', fontSize:11, fontWeight:800 }}>{statusLabel}</span>
            <div style={{ color:'var(--text-strong)', fontSize:14, fontWeight:800 }}>{incoming ? `${assignment.createdByParentName} te propone una asignación` : `Has asignado a ${assignment.collaboratorName}`}</div>
          </div>
          <div style={{ fontSize:11, color:statusTone, fontWeight:800, textAlign:'right' }}>{assignment.type === 'partial_slot' ? 'TRAMO' : 'DÍA'}</div>
        </div>
        <div style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:12, color:'var(--text-secondary)', background:'var(--bg-soft)', border:'1px solid var(--border)', padding:'7px 10px', borderRadius:12, marginBottom:10 }}>
          <span>🤝</span>
          <span style={{ fontWeight:700 }}>{formatDate(assignment.date)}{assignment.type === 'partial_slot' && assignment.startTime && assignment.endTime ? ` · ${assignment.startTime}-${assignment.endTime}` : ' · Día completo'}</span>
        </div>
        {assignment.notes ? <div style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.5 }}><span style={{ color:'var(--text-muted)' }}>Observaciones: </span>{assignment.notes}</div> : null}
        {incoming && assignment.status === 'pending' && (
          <div style={{ display:'flex', gap:8, marginTop:14 }}>
            <button className="req-action-btn btn-reject" onClick={() => respondCollaborator(assignment, false)}>✕ Rechazar</button>
            <button className="req-action-btn btn-accept" onClick={() => respondCollaborator(assignment, true)}>✓ Aceptar</button>
          </div>
        )}
        {!incoming && assignment.status === 'pending' && (
          <div style={{ display:'flex', gap:8, marginTop:14 }}>
            <button className="req-action-btn btn-reject" onClick={() => cancelOutgoingCollaborator(assignment)}>Cancelar asignación</button>
          </div>
        )}
      </div>
    )
  }

  const EventAssignmentCard = ({ event, incoming }: { event: SchoolEvent; incoming: boolean }) => {
    const assignedName = event.assignedParentId && child ? child.parentNames?.[event.assignedParentId] : 'el otro progenitor'
    const openEvent = () => {
      navigateToTarget({ tab: 'events', childId: event.childId, date: event.date, focusTargetId: `event-${event.id}` })
    }
    return (
      <div style={{ background:'linear-gradient(180deg, rgba(59,130,246,0.10) 0%, var(--bg-card) 30%, var(--bg-soft) 100%)', border:'1px solid rgba(59,130,246,0.26)', borderRadius:22, padding:16, marginBottom:10, boxShadow:'var(--card-shadow)' }}>
        <div style={{ marginBottom:10 }}>
          <span style={{ display:'inline-flex', alignItems:'center', padding:'5px 10px', borderRadius:999, background:'rgba(59,130,246,0.14)', color:'#60a5fa', fontSize:11, fontWeight:800 }}>Asignación de evento pendiente</span>
        </div>
        <button onClick={openEvent} style={{ width:'100%', textAlign:'left', background:'none', border:'none', padding:0, cursor:'pointer' }}>
          <div style={{ color:'var(--text-strong)', fontSize:14, fontWeight:800, marginBottom:6 }}>{incoming ? `${event.assignmentRequestedByName || 'El otro progenitor'} quiere asignarte este evento` : `Has pedido asignar este evento a ${assignedName}`}</div>
          <div style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:12, color:'var(--text-secondary)', background:'var(--bg-soft)', border:'1px solid var(--border)', padding:'7px 10px', borderRadius:12, marginBottom:10 }}>🎓 <span style={{ fontWeight:700 }}>{event.title}</span> · <span>{formatDate(event.date)}{event.endDate ? ` → ${formatDate(event.endDate)}` : ''}</span></div>
          <div style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.45 }}>{event.allDay ? 'Evento de todo el día' : `Hora: ${event.time || 'Sin hora'}`}</div>
        </button>
        <div style={{ display:'flex', gap:8, marginTop:14, flexWrap:'wrap' }}>
          <button className="req-action-btn" style={{ background:'var(--bg-soft)', border:'1px solid var(--border)', color:'var(--text-secondary)' }} onClick={openEvent}>Abrir evento</button>
          {incoming ? (
            <>
              <button className="req-action-btn btn-reject" onClick={() => respondEventAssignment(event, false)}>✕ Rechazar</button>
              <button className="req-action-btn btn-accept" onClick={() => respondEventAssignment(event, true)}>✓ Aceptar</button>
            </>
          ) : (
            <button className="req-action-btn btn-reject" onClick={() => cancelOutgoingEventAssignment(event)}>Cancelar asignación</button>
          )}
        </div>
      </div>
    )
  }

  const Section = ({ title, count, children, collapsible, open, onToggle, tone = 'default' }: any) => {
    if (count === 0) return null
    const toneColor = tone === 'warning' ? '#f59e0b' : tone === 'info' ? '#60a5fa' : tone === 'success' ? '#10b981' : tone === 'violet' ? '#8B5CF6' : 'var(--text-secondary)'
    return (
      <div style={{ marginBottom: 14 }}>
        <button onClick={collapsible ? onToggle : undefined} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', background:'none', border:'none', padding:'0 0 10px 0', cursor: collapsible ? 'pointer' : 'default' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div className="section-title" style={{ margin:0, color:'var(--text-strong)' }}>{title}</div>
            <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', minWidth:22, height:22, padding:'0 7px', borderRadius:999, background:'var(--bg-soft)', border:'1px solid var(--border)', color:toneColor, fontSize:11, fontWeight:800 }}>{count}</span>
          </div>
          {collapsible && <span style={{ color:'var(--text-muted)', fontSize:12 }}>{open ? 'Ocultar' : 'Mostrar'}</span>}
        </button>
        {(!collapsible || open) && children}
      </div>
    )
  }

  const renderRequestCard = (req: ChangeRequest, isIncoming: boolean) => {
    const searchId = `request-${req.id}`
    return <div key={req.id} ref={el => { cardRefs.current[searchId] = el }} style={highlightedId === searchId ? { borderRadius: 22, boxShadow: '0 0 0 2px rgba(245,158,11,0.45), 0 18px 40px rgba(245,158,11,0.14)', transition: 'box-shadow 0.2s ease' } : undefined}><Card req={req} isIncoming={isIncoming} /></div>
  }

  const renderCollaboratorCard = (assignment: CollaboratorAssignment, incoming: boolean) => {
    const searchId = `collaborator-assignment-${assignment.id}`
    return <div key={assignment.id} ref={el => { cardRefs.current[searchId] = el }} style={highlightedId === searchId ? { borderRadius: 22, boxShadow: '0 0 0 2px rgba(139,92,246,0.45), 0 18px 40px rgba(139,92,246,0.14)', transition: 'box-shadow 0.2s ease' } : undefined}><CollaboratorCard assignment={assignment} incoming={incoming} /></div>
  }

  const renderEventAssignmentCard = (event: SchoolEvent, incoming: boolean) => {
    const searchId = `event-${event.id}`
    return <div key={event.id} ref={el => { cardRefs.current[searchId] = el }} style={highlightedId === searchId ? { borderRadius: 22, boxShadow: '0 0 0 2px rgba(59,130,246,0.45), 0 18px 40px rgba(59,130,246,0.14)', transition: 'box-shadow 0.2s ease' } : undefined}><EventAssignmentCard event={event} incoming={incoming} /></div>
  }

  if (isCollaboratorForSelectedChild && !isParentForSelectedChild) {
    const collaboratorPending = grouped.incomingCollaboratorAssignments.length
    const collaboratorResolved = grouped.resolvedCollaboratorAssignments.length
    const collaboratorCancelled = grouped.cancelledCollaboratorAssignments.length

    return (
      <div>
        <div className="card" style={{ marginBottom:16, padding:16, borderRadius:20, background:'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-soft) 100%)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
            <div>
              <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:800, textTransform:'uppercase', letterSpacing:0.4, marginBottom:4 }}>Coordinación</div>
              <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                <div className="page-title" style={{ marginBottom:0 }}>Asignaciones</div>
                {collaboratorPending > 0 && <span style={{ background:'rgba(139,92,246,0.14)', color:'#8B5CF6', fontSize:11, fontWeight:800, padding:'4px 10px', borderRadius:999 }}>{collaboratorPending} pendientes</span>}
              </div>
              <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:4 }}>Aquí solo ves las asignaciones que te han enviado como colaborador.</div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2, auto)', gap:8 }}>
              <div style={{ padding:'8px 10px', borderRadius:12, background:'rgba(139,92,246,0.10)', border:'1px solid rgba(139,92,246,0.20)', color:'#c4b5fd', fontSize:11, fontWeight:800 }}>Pendientes: {collaboratorPending}</div>
              <div style={{ padding:'8px 10px', borderRadius:12, background:'rgba(16,185,129,0.10)', border:'1px solid rgba(16,185,129,0.20)', color:'#6ee7b7', fontSize:11, fontWeight:800 }}>Resueltas: {collaboratorResolved}</div>
            </div>
          </div>
        </div>
        <Section title="Asignaciones pendientes" count={grouped.incomingCollaboratorAssignments.length} tone="violet">{grouped.incomingCollaboratorAssignments.map(a => renderCollaboratorCard(a, true))}</Section>
        <Section title="Resueltas" count={grouped.resolvedCollaboratorAssignments.length} collapsible open={showResolved} onToggle={() => setShowResolved(v => !v)} tone="success">{grouped.resolvedCollaboratorAssignments.map(a => renderCollaboratorCard(a, true))}</Section>
        <Section title="Canceladas" count={grouped.cancelledCollaboratorAssignments.length} collapsible open={showCancelled} onToggle={() => setShowCancelled(v => !v)}>{grouped.cancelledCollaboratorAssignments.map(a => renderCollaboratorCard(a, true))}</Section>
      </div>
    )
  }

  const totalPending = grouped.incomingPending.length + grouped.outgoingPending.length + grouped.incomingEventAssignments.length + grouped.outgoingEventAssignments.length + grouped.incomingCollaboratorAssignments.length + grouped.outgoingCollaboratorAssignments.length

  return (
    <div>
      <div className="card" style={{ marginBottom:16, padding:16, borderRadius:20, background:'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-soft) 100%)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
          <div>
            <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:800, textTransform:'uppercase', letterSpacing:0.4, marginBottom:4 }}>Coordinación</div>
            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
              <div className="page-title" style={{ marginBottom:0 }}>Cambios</div>
              {totalPending > 0 && <span style={{ background:'rgba(245,158,11,0.14)', color:'#f59e0b', fontSize:11, fontWeight:800, padding:'4px 10px', borderRadius:999 }}>{totalPending} pendientes</span>}
            </div>
            <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:4 }}>Solicitudes de cambio y asignaciones entre progenitores, además de asignaciones a colaboradores.</div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2, auto)', gap:8 }}>
            <div style={{ padding:'8px 10px', borderRadius:12, background:'rgba(59,130,246,0.10)', border:'1px solid rgba(59,130,246,0.20)', color:'#93c5fd', fontSize:11, fontWeight:800 }}>Recibidas: {grouped.incomingPending.length + grouped.incomingEventAssignments.length + grouped.incomingCollaboratorAssignments.length}</div>
            <div style={{ padding:'8px 10px', borderRadius:12, background:'rgba(16,185,129,0.10)', border:'1px solid rgba(16,185,129,0.20)', color:'#6ee7b7', fontSize:11, fontWeight:800 }}>Resueltas: {grouped.resolved.length + grouped.resolvedCollaboratorAssignments.length}</div>
          </div>
        </div>
      </div>
      <Section title="Pendientes recibidas" count={grouped.incomingPending.length} tone="warning">{grouped.incomingPending.map(r => renderRequestCard(r, true))}</Section>
      <Section title="Asignaciones de eventos pendientes" count={grouped.incomingEventAssignments.length} tone="info">{grouped.incomingEventAssignments.map(e => renderEventAssignmentCard(e, true))}</Section>
      <Section title="Asignaciones a colaboradores recibidas" count={grouped.incomingCollaboratorAssignments.length} tone="violet">{grouped.incomingCollaboratorAssignments.map(a => renderCollaboratorCard(a, true))}</Section>
      <Section title="Pendientes enviadas" count={grouped.outgoingPending.length} tone="info">{grouped.outgoingPending.map(r => renderRequestCard(r, false))}</Section>
      <Section title="Asignaciones de eventos enviadas" count={grouped.outgoingEventAssignments.length} tone="info">{grouped.outgoingEventAssignments.map(e => renderEventAssignmentCard(e, false))}</Section>
      <Section title="Asignaciones a colaboradores enviadas" count={grouped.outgoingCollaboratorAssignments.length} tone="violet">{grouped.outgoingCollaboratorAssignments.map(a => renderCollaboratorCard(a, false))}</Section>
      <Section title="Resueltas" count={grouped.resolved.length + grouped.resolvedCollaboratorAssignments.length} collapsible open={showResolved} onToggle={() => setShowResolved(v => !v)} tone="success">{grouped.resolved.map(r => renderRequestCard(r, r.toParentId === user?.uid))}{grouped.resolvedCollaboratorAssignments.map(a => renderCollaboratorCard(a, a.collaboratorId === user?.uid))}</Section>
      <Section title="Canceladas" count={grouped.cancelled.length + grouped.cancelledCollaboratorAssignments.length} collapsible open={showCancelled} onToggle={() => setShowCancelled(v => !v)}>{grouped.cancelled.map(r => renderRequestCard(r, r.toParentId === user?.uid))}{grouped.cancelledCollaboratorAssignments.map(a => renderCollaboratorCard(a, a.collaboratorId === user?.uid))}</Section>
    </div>
  )
}
