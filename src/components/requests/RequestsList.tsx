'use client'
import { useMemo } from 'react'
import { format, eachDayOfInterval, parseISO } from 'date-fns'
import { useAppStore } from '@/store/app'
import { useAuth } from '@/lib/auth-context'
import { respondToRequest, setOverride, cancelRequest, deleteRequest } from '@/lib/db'
import { formatDate, getParentForDate } from '@/lib/utils'
import type { ChangeRequest } from '@/types'

export function RequestsList() {
  const { user } = useAuth()
  const { requests, children, selectedChildId, pattern, overrides, specialPeriods } = useAppStore()
  const child = useMemo(() => children.find(c => c.id === selectedChildId) ?? null, [children, selectedChildId])
  const { incoming, outgoing } = useMemo(() => !user ? { incoming:[], outgoing:[] } : {
    incoming: requests.filter(r => r.toParentId === user.uid),
    outgoing: requests.filter(r => r.fromParentId === user.uid),
  }, [requests, user?.uid])

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

  if (requests.length === 0) return (
    <div className="empty-state">
      <div className="empty-state-icon">💬</div>
      <div className="empty-state-title">No hay solicitudes de cambio</div>
      <div className="empty-state-sub">Las peticiones aparecerán aquí</div>
    </div>
  )

  const Card = ({ req, isIncoming }: { req: ChangeRequest; isIncoming: boolean }) => {
    const dateText = req.type === 'single' ? formatDate(req.date!) : `${formatDate(req.startDate!)} → ${formatDate(req.endDate!)}`
    const borderColor = req.status === 'pending' ? 'rgba(245,158,11,0.3)' : req.status === 'accepted' ? 'rgba(16,185,129,0.3)' : req.status === 'cancelled' ? 'rgba(107,114,128,0.3)' : 'rgba(239,68,68,0.3)'
    const bgColor = req.status === 'pending' ? 'rgba(245,158,11,0.06)' : req.status === 'accepted' ? 'rgba(16,185,129,0.06)' : req.status === 'cancelled' ? 'rgba(107,114,128,0.06)' : 'rgba(239,68,68,0.06)'
    const badgeText = req.status === 'pending' ? 'Pendiente' : req.status === 'accepted' ? 'Aceptada' : req.status === 'cancelled' ? 'Cancelada' : 'Rechazada'
    return (
      <div className="req-card" style={{ borderColor, background: bgColor }}>
        <div><span className={`req-badge ${req.status === 'cancelled' ? 'rejected' : req.status}`}>{badgeText}</span></div>
        <div className="req-title">{isIncoming ? req.fromParentName : 'Tú'} pide cambio · {req.type === 'single' ? 'Día concreto' : 'Rango de fechas'}</div>
        <div className="req-date">📅 {dateText}</div>
        <div className="req-reason"><span style={{color:'#6b7280'}}>Motivo: </span>{req.reason}</div>
        {isIncoming && req.status === 'pending' && (
          <div className="req-actions">
            <button className="req-action-btn btn-reject" onClick={() => respondToRequest(req.id, 'rejected')}>✕ Rechazar</button>
            <button className="req-action-btn btn-accept" onClick={() => handleAccept(req)}>✓ Aceptar</button>
          </div>
        )}
        {!isIncoming && req.status === 'pending' && (
          <div className="req-actions">
            <button className="req-action-btn btn-reject" onClick={() => cancelRequest(req.id)}>Cancelar solicitud</button>
          </div>
        )}
        {req.status === 'cancelled' && (
          <div className="req-actions">
            <button className="req-action-btn btn-reject" onClick={() => deleteRequest(req.id)}>Eliminar</button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {incoming.length > 0 && <><div className="section-title">Recibidas ({incoming.length})</div>{incoming.map(r => <Card key={r.id} req={r} isIncoming />)}</>}
      {outgoing.length > 0 && <><div className="section-title" style={{marginTop:16}}>Enviadas ({outgoing.length})</div>{outgoing.map(r => <Card key={r.id} req={r} isIncoming={false} />)}</>}
    </div>
  )
}
