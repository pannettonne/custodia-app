'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { format, eachDayOfInterval, parseISO } from 'date-fns'
import { useAppStore } from '@/store/app'
import { useAuth } from '@/lib/auth-context'
import { respondToRequest, setOverride, cancelRequest, deleteRequest, updateEvent, createNotification, clearPendingEventAssignment } from '@/lib/db'
import { formatDate, getParentForDate } from '@/lib/utils'
import type { ChangeRequest, SchoolEvent } from '@/types'

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
  const { requests, events, children, selectedChildId, pattern, overrides, specialPeriods } = useAppStore()
  const child = useMemo(() => children.find(c => c.id === selectedChildId) ?? null, [children, selectedChildId])
  const [showResolved, setShowResolved] = useState(false)
  const [showCancelled, setShowCancelled] = useState(false)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const grouped = useMemo(() => {
    if (!user) return { incomingPending:[], outgoingPending:[], incomingEventAssignments:[], outgoingEventAssignments:[], resolved:[], cancelled:[] }
    const incomingPending = requests.filter(r => r.toParentId === user.uid && r.status === 'pending')
    const outgoingPending = requests.filter(r => r.fromParentId === user.uid && r.status === 'pending')
    const incomingEventAssignments = events.filter(e => e.assignmentStatus === 'pending' && e.assignmentRequestToParentId === user.uid)
    const outgoingEventAssignments = events.filter(e => e.assignmentStatus === 'pending' && e.assignmentRequestedBy === user.uid)
    const resolved = requests.filter(r => ['accepted','rejected'].includes(r.status))
    const cancelled = requests.filter(r => r.status === 'cancelled')
    return { incomingPending, outgoingPending, incomingEventAssignments, outgoingEventAssignments, resolved, cancelled }
  }, [requests, events, user?.uid])

  useEffect(() => {
    if (!focusTargetId || !focusTargetId.startsWith('request-')) return
    const target = cardRefs.current[focusTargetId]
    if (!target) return
    const timer = window.setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setHighlightedId(focusTargetId)
      const matchedResolved = grouped.resolved.some(r => `request-${r.id}` === focusTargetId)
      const matchedCancelled = grouped.cancelled.some(r => `request-${r.id}` === focusTargetId)
      if (matchedResolved) setShowResolved(true)
      if (matchedCancelled) setShowCancelled(true)
    }, 80)
    const clearTimer = window.setTimeout(() => setHighlightedId(current => current === focusTargetId ? null : current), 2600)
    return () => {
      window.clearTimeout(timer)
      window.clearTimeout(clearTimer)
    }
  }, [focusTargetId, focusSeq, grouped])

  const notifyRequester = async (req: ChangeRequest, accepted: boolean) => {
    await createNotification({ userId: req.fromParentId, childId: req.childId, childName: child?.name, type: 'pending_request', title: accepted ? 'Solicitud de cambio aceptada' : 'Solicitud de cambio rechazada', body: `${user?.displayName || user?.email || 'El otro progenitor'} ha ${accepted ? 'aceptado' : 'rechazado'} tu solicitud de cambio.`, dateKey: `change-request-response:${req.id}:${accepted ? 'accepted' : 'rejected'}` })
  }

  const handleAccept = async (req: ChangeRequest) => {
    if (!child || !user) return
    await respondToRequest(req.id, 'accepted')
    const dates = req.type === 'single' ? [req.date!] : eachDayOfInterval({ start: parseISO(req.startDate!), end: parseISO(req.endDate!) }).map(d => format(d,'yyyy-MM-dd'))
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
    await createNotification({ userId: req.toParentId, childId: req.childId, childName: child?.name, type: 'pending_request', title: 'Solicitud de cambio cancelada', body: `${user?.displayName || user?.email || 'El otro progenitor'} ha cancelado una solicitud de cambio pendiente.`, dateKey: `change-request-cancel:${req.id}` })
  }

  const respondEventAssignment = async (event: SchoolEvent, accept: boolean) => {
    if (!user || !child) return
    if (!accept) {
      await updateEvent(event.id, { assignmentStatus: 'rejected' })
      if (event.assignmentRequestedBy) await createNotification({ userId: event.assignmentRequestedBy, childId: event.childId, childName: child.name, type: 'event_assignment_response', title: 'Asignación de evento rechazada', body: `${user.displayName || user.email || 'Progenitor'} ha rechazado la asignación del evento “${event.title}”.`, dateKey: event.date })
      return
    }
    await updateEvent(event.id, { assignmentStatus: 'accepted' })
    if (event.allDay && event.assignedParentId) {
      for (const date of listDates(event.date, event.endDate)) {
        await setOverride({ childId: event.childId, date, parentId: event.assignedParentId, reason: `Asignación por evento: ${event.title}`, createdBy: user.uid })
      }
    }
    if (event.assignmentRequestedBy) await createNotification({ userId: event.assignmentRequestedBy, childId: event.childId, childName: child.name, type: 'event_assignment_response', title: 'Asignación de evento aceptada', body: `${user.displayName || user.email || 'Progenitor'} ha aceptado la asignación del evento “${event.title}”.`, dateKey: event.date })
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
  }

  if (requests.length === 0 && grouped.incomingEventAssignments.length === 0 && grouped.outgoingEventAssignments.length === 0) {
    return <div className="empty-state"><div className="empty-state-icon">💬</div><div className="empty-state-title">No hay solicitudes de cambio</div><div className="empty-state-sub">Las peticiones aparecerán aquí</div></div>
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

        <div style={{ fontSize: 12, color:'var(--text-secondary)', lineHeight: 1.5 }}>
          <span style={{ color:'var(--text-muted)' }}>Motivo: </span>{req.reason}
        </div>

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

  const EventAssignmentCard = ({ event, incoming }: { event: SchoolEvent; incoming: boolean }) => {
    const assignedName = event.assignedParentId && child ? child.parentNames?.[event.assignedParentId] : 'el otro progenitor'
    return (
      <div style={{ background:'linear-gradient(180deg, rgba(59,130,246,0.10) 0%, var(--bg-card) 30%, var(--bg-soft) 100%)', border:'1px solid rgba(59,130,246,0.26)', borderRadius:22, padding:16, marginBottom:10, boxShadow:'var(--card-shadow)' }}>
        <div style={{ marginBottom:10 }}>
          <span style={{ display:'inline-flex', alignItems:'center', padding:'5px 10px', borderRadius:999, background:'rgba(59,130,246,0.14)', color:'#60a5fa', fontSize:11, fontWeight:800 }}>Asignación de evento pendiente</span>
        </div>
        <div style={{ color:'var(--text-strong)', fontSize:14, fontWeight:800, marginBottom:6 }}>{incoming ? `${event.assignmentRequestedByName || 'El otro progenitor'} quiere asignarte este evento` : `Has pedido asignar este evento a ${assignedName}`}</div>
        <div style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:12, color:'var(--text-secondary)', background:'var(--bg-soft)', border:'1px solid var(--border)', padding:'7px 10px', borderRadius:12, marginBottom:10 }}>🎓 <span style={{ fontWeight:700 }}>{event.title}</span> · <span>{formatDate(event.date)}{event.endDate ? ` → ${formatDate(event.endDate)}` : ''}</span></div>
        <div style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.45 }}>{event.allDay ? 'Evento de todo el día' : `Hora: ${event.time || 'Sin hora'}`}</div>
        {incoming ? (
          <div style={{ display:'flex', gap:8, marginTop:14 }}>
            <button className="req-action-btn btn-reject" onClick={() => respondEventAssignment(event, false)}>✕ Rechazar</button>
            <button className="req-action-btn btn-accept" onClick={() => respondEventAssignment(event, true)}>✓ Aceptar</button>
          </div>
        ) : (
          <div style={{ display:'flex', gap:8, marginTop:14 }}>
            <button className="req-action-btn btn-reject" onClick={() => cancelOutgoingEventAssignment(event)}>Cancelar asignación</button>
          </div>
        )}
      </div>
    )
  }

  const Section = ({ title, count, children, collapsible, open, onToggle, tone = 'default' }: any) => {
    if (count === 0) return null
    const toneColor = tone === 'warning' ? '#f59e0b' : tone === 'info' ? '#60a5fa' : tone === 'success' ? '#10b981' : 'var(--text-secondary)'
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

  const totalPending = grouped.incomingPending.length + grouped.outgoingPending.length + grouped.incomingEventAssignments.length + grouped.outgoingEventAssignments.length

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
            <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:4 }}>Solicitudes de cambio y asignaciones entre progenitores, más claras y fáciles de revisar.</div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2, auto)', gap:8 }}>
            <div style={{ padding:'8px 10px', borderRadius:12, background:'rgba(59,130,246,0.10)', border:'1px solid rgba(59,130,246,0.20)', color:'#93c5fd', fontSize:11, fontWeight:800 }}>Recibidas: {grouped.incomingPending.length}</div>
            <div style={{ padding:'8px 10px', borderRadius:12, background:'rgba(16,185,129,0.10)', border:'1px solid rgba(16,185,129,0.20)', color:'#6ee7b7', fontSize:11, fontWeight:800 }}>Resueltas: {grouped.resolved.length}</div>
          </div>
        </div>
      </div>

      <Section title="Pendientes recibidas" count={grouped.incomingPending.length} tone="warning">{grouped.incomingPending.map(r => renderRequestCard(r, true))}</Section>
      <Section title="Asignaciones de eventos pendientes" count={grouped.incomingEventAssignments.length} tone="info">{grouped.incomingEventAssignments.map(e => <EventAssignmentCard key={e.id} event={e} incoming />)}</Section>
      <Section title="Pendientes enviadas" count={grouped.outgoingPending.length} tone="info">{grouped.outgoingPending.map(r => renderRequestCard(r, false))}</Section>
      <Section title="Asignaciones de eventos enviadas" count={grouped.outgoingEventAssignments.length} tone="info">{grouped.outgoingEventAssignments.map(e => <EventAssignmentCard key={e.id} event={e} incoming={false} />)}</Section>
      <Section title="Resueltas" count={grouped.resolved.length} collapsible open={showResolved} onToggle={() => setShowResolved(v => !v)} tone="success">{grouped.resolved.map(r => renderRequestCard(r, r.toParentId === user?.uid))}</Section>
      <Section title="Canceladas" count={grouped.cancelled.length} collapsible open={showCancelled} onToggle={() => setShowCancelled(v => !v)}>{grouped.cancelled.map(r => renderRequestCard(r, r.toParentId === user?.uid))}</Section>
    </div>
  )
}
