'use client'
import { useMemo, useState } from 'react'
import { format, eachDayOfInterval, parseISO } from 'date-fns'
import { useAppStore } from '@/store/app'
import { useAuth } from '@/lib/auth-context'
import { respondToRequest, setOverride, cancelRequest, deleteRequest, updateEvent, createNotification } from '@/lib/db'
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

export function RequestsList() {
  const { user } = useAuth()
  const { requests, events, children, selectedChildId, pattern, overrides, specialPeriods } = useAppStore()
  const child = useMemo(() => children.find(c => c.id === selectedChildId) ?? null, [children, selectedChildId])
  const [showResolved, setShowResolved] = useState(false)
  const [showCancelled, setShowCancelled] = useState(false)

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

  const handleAccept = async (req: ChangeRequest) => {
    if (!child || !user) return
    await respondToRequest(req.id, 'accepted')
    const dates = req.type === 'single'
      ? [req.date!]
      : eachDayOfInterval({ start: parseISO(req.startDate!), end: parseISO(req.endDate!) }).map(d => format(d,'yyyy-MM-dd'))

    for (const date of dates) {
      const currentOwner = getParentForDate(new Date(date + 'T12:00:00'), pattern, overrides, child, specialPeriods)
      const otherParent = child.parents.find(pid => pid !== currentOwner) ?? req.fromParentId
      const targetParentId = currentOwner === req.fromParentId ? otherParent : req.fromParentId
      await setOverride({ childId: req.childId, date, parentId: targetParentId, reason: req.reason, createdBy: user.uid })
    }
  }

  const respondEventAssignment = async (event: SchoolEvent, accept: boolean) => {
    if (!user || !child) return
    if (!accept) {
      await updateEvent(event.id, { assignmentStatus: 'rejected' })
      if (event.assignmentRequestedBy) {
        await createNotification({ userId: event.assignmentRequestedBy, childId: event.childId, childName: child.name, type: 'event_assignment_response', title: 'Asignación de evento rechazada', body: `${user.displayName || user.email || 'Progenitor'} ha rechazado la asignación del evento “${event.title}”.`, dateKey: event.date })
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
      await createNotification({ userId: event.assignmentRequestedBy, childId: event.childId, childName: child.name, type: 'event_assignment_response', title: 'Asignación de evento aceptada', body: `${user.displayName || user.email || 'Progenitor'} ha aceptado la asignación del evento “${event.title}”.`, dateKey: event.date })
    }
  }

  if (requests.length === 0 && grouped.incomingEventAssignments.length === 0 && grouped.outgoingEventAssignments.length === 0) return (
    <div className="empty-state">
      <div className="empty-state-icon">💬</div>
      <div className="empty-state-title">No hay solicitudes de cambio</div>
      <div className="empty-state-sub">Las peticiones aparecerán aquí</div>
    </div>
  )

  const Card = ({ req, isIncoming }: { req: ChangeRequest; isIncoming: boolean }) => {
    const dateText = req.type === 'single' ? formatDate(req.date!) : `${formatDate(req.startDate!)} → ${formatDate(req.endDate!)}`
    const palette = req.status === 'pending'
      ? { border: 'rgba(245,158,11,0.30)', bg: 'var(--bg-card)', badgeBg: 'rgba(245,158,11,0.14)', badgeColor: '#f59e0b' }
      : req.status === 'accepted'
      ? { border: 'rgba(16,185,129,0.28)', bg: 'var(--bg-card)', badgeBg: 'rgba(16,185,129,0.14)', badgeColor: '#10b981' }
      : req.status === 'cancelled'
      ? { border: 'var(--border)', bg: 'var(--bg-card)', badgeBg: 'var(--bg-soft)', badgeColor: 'var(--text-muted)' }
      : { border: 'rgba(239,68,68,0.26)', bg: 'var(--bg-card)', badgeBg: 'rgba(239,68,68,0.14)', badgeColor: '#ef4444' }
    const badgeText = req.status === 'pending' ? 'Pendiente' : req.status === 'accepted' ? 'Aceptada' : req.status === 'cancelled' ? 'Cancelada' : 'Rechazada'

    return (
      <div style={{ background: palette.bg, border: `1px solid ${palette.border}`, borderRadius: 18, padding: 14, marginBottom: 10, boxShadow: 'var(--card-shadow)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, marginBottom: 10 }}>
          <span style={{ display:'inline-flex', alignItems:'center', padding:'5px 10px', borderRadius: 999, background: palette.badgeBg, color: palette.badgeColor, fontSize: 11, fontWeight: 800 }}>{badgeText}</span>
        </div>

        <div style={{ color:'var(--text-strong)', fontSize: 14, fontWeight: 800, marginBottom: 6 }}>
          {isIncoming ? req.fromParentName : 'Tú'} pide cambio · {req.type === 'single' ? 'Día concreto' : 'Rango de fechas'}
        </div>

        <div style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize: 12, color:'var(--text-secondary)', background:'var(--bg-soft)', border:'1px solid var(--border)', padding:'5px 10px', borderRadius: 10, marginBottom: 10 }}>
          <span>📅</span>
          <span style={{ fontWeight: 700 }}>{dateText}</span>
        </div>

        <div style={{ fontSize: 12, color:'var(--text-secondary)', lineHeight: 1.45 }}>
          <span style={{ color:'var(--text-muted)' }}>Motivo: </span>{req.reason}
        </div>

        {isIncoming && req.status === 'pending' && (
          <div style={{ display:'flex', gap:8, marginTop: 12 }}>
            <button className="req-action-btn btn-reject" onClick={() => respondToRequest(req.id, 'rejected')}>✕ Rechazar</button>
            <button className="req-action-btn btn-accept" onClick={() => handleAccept(req)}>✓ Aceptar</button>
          </div>
        )}

        {!isIncoming && req.status === 'pending' && (
          <div style={{ display:'flex', gap:8, marginTop: 12 }}>
            <button className="req-action-btn btn-reject" onClick={() => cancelRequest(req.id)}>Cancelar solicitud</button>
          </div>
        )}

        {req.status === 'cancelled' && (
          <div style={{ display:'flex', gap:8, marginTop: 12 }}>
            <button className="req-action-btn btn-reject" onClick={() => deleteRequest(req.id)}>Eliminar</button>
          </div>
        )}
      </div>
    )
  }

  const EventAssignmentCard = ({ event, incoming }: { event: SchoolEvent; incoming: boolean }) => {
    const assignedName = event.assignedParentId && child ? child.parentNames?.[event.assignedParentId] : 'el otro progenitor'
    return (
      <div style={{ background:'var(--bg-card)', border:'1px solid rgba(59,130,246,0.26)', borderRadius:18, padding:14, marginBottom:10, boxShadow:'var(--card-shadow)' }}>
        <div style={{ marginBottom:10 }}>
          <span style={{ display:'inline-flex', alignItems:'center', padding:'5px 10px', borderRadius:999, background:'rgba(59,130,246,0.14)', color:'#60a5fa', fontSize:11, fontWeight:800 }}>Asignación de evento pendiente</span>
        </div>
        <div style={{ color:'var(--text-strong)', fontSize:14, fontWeight:800, marginBottom:6 }}>{incoming ? `${event.assignmentRequestedByName || 'El otro progenitor'} quiere asignarte este evento` : `Has pedido asignar este evento a ${assignedName}`}</div>
        <div style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:12, color:'var(--text-secondary)', background:'var(--bg-soft)', border:'1px solid var(--border)', padding:'5px 10px', borderRadius:10, marginBottom:10 }}>🎓 <span style={{ fontWeight:700 }}>{event.title}</span> · <span>{formatDate(event.date)}{event.endDate ? ` → ${formatDate(event.endDate)}` : ''}</span></div>
        <div style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.45 }}>{event.allDay ? 'Evento de todo el día' : `Hora: ${event.time || 'Sin hora'}`}</div>
        {incoming ? (
          <div style={{ display:'flex', gap:8, marginTop:12 }}>
            <button className="req-action-btn btn-reject" onClick={() => respondEventAssignment(event, false)}>✕ Rechazar</button>
            <button className="req-action-btn btn-accept" onClick={() => respondEventAssignment(event, true)}>✓ Aceptar</button>
          </div>
        ) : null}
      </div>
    )
  }

  const Section = ({ title, count, children, collapsible, open, onToggle }: any) => {
    if (count === 0) return null
    return <div style={{ marginBottom: 14 }}><button onClick={collapsible ? onToggle : undefined} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', background:'none', border:'none', padding:'0 0 8px 0', cursor: collapsible ? 'pointer' : 'default' }}><div className="section-title" style={{ margin:0 }}>{title} ({count})</div>{collapsible && <span style={{ color:'var(--text-muted)', fontSize:12 }}>{open ? 'Ocultar' : 'Mostrar'}</span>}</button>{(!collapsible || open) && children}</div>
  }

  return (
    <div>
      <Section title="Pendientes recibidas" count={grouped.incomingPending.length}>{grouped.incomingPending.map(r => <Card key={r.id} req={r} isIncoming />)}</Section>
      <Section title="Asignaciones de eventos pendientes" count={grouped.incomingEventAssignments.length}>{grouped.incomingEventAssignments.map(e => <EventAssignmentCard key={e.id} event={e} incoming />)}</Section>
      <Section title="Pendientes enviadas" count={grouped.outgoingPending.length}>{grouped.outgoingPending.map(r => <Card key={r.id} req={r} isIncoming={false} />)}</Section>
      <Section title="Asignaciones de eventos enviadas" count={grouped.outgoingEventAssignments.length}>{grouped.outgoingEventAssignments.map(e => <EventAssignmentCard key={e.id} event={e} incoming={false} />)}</Section>
      <Section title="Resueltas" count={grouped.resolved.length} collapsible open={showResolved} onToggle={() => setShowResolved(v => !v)}>{grouped.resolved.map(r => <Card key={r.id} req={r} isIncoming={r.toParentId === user?.uid} />)}</Section>
      <Section title="Canceladas" count={grouped.cancelled.length} collapsible open={showCancelled} onToggle={() => setShowCancelled(v => !v)}>{grouped.cancelled.map(r => <Card key={r.id} req={r} isIncoming={r.toParentId === user?.uid} />)}</Section>
    </div>
  )
}
