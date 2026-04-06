'use client'
import { useMemo } from 'react'
import { format, eachDayOfInterval, parseISO } from 'date-fns'
import { useAppStore } from '@/store/app'
import { useAuth } from '@/lib/auth-context'
import { respondToRequest, setOverride } from '@/lib/db'
import { formatDate } from '@/lib/utils'
import type { ChangeRequest } from '@/types'

export function RequestsList() {
  const { user } = useAuth()
  const { requests, children, selectedChildId } = useAppStore()
  const child = useMemo(() => children.find(c => c.id === selectedChildId) ?? null, [children, selectedChildId])
  const { incoming, outgoing } = useMemo(() => !user ? { incoming:[], outgoing:[] } : {
    incoming: requests.filter(r => r.toParentId === user.uid),
    outgoing: requests.filter(r => r.fromParentId === user.uid),
  }, [requests, user?.uid])

  const handleAccept = async (req: ChangeRequest) => {
    if (!child || !user) return
    await respondToRequest(req.id, 'accepted')
    const dates = req.type === 'single' ? [req.date!] : eachDayOfInterval({ start: parseISO(req.startDate!), end: parseISO(req.endDate!) }).map(d => format(d,'yyyy-MM-dd'))
    for (const date of dates) await setOverride({ childId: req.childId, date, parentId: req.fromParentId, reason: req.reason, createdBy: user.uid })
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
    const borderColor = req.status === 'pending' ? 'rgba(245,158,11,0.3)' : req.status === 'accepted' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'
    const bgColor = req.status === 'pending' ? 'rgba(245,158,11,0.06)' : req.status === 'accepted' ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)'
    return (
      <div className="req-card" style={{ borderColor, background: bgColor }}>
        <div><span className={`req-badge ${req.status}`}>{req.status === 'pending' ? 'Pendiente' : req.status === 'accepted' ? 'Aceptada' : 'Rechazada'}</span></div>
        <div className="req-title">{isIncoming ? req.fromParentName : 'Tú'} pide cambio · {req.type === 'single' ? 'Día concreto' : 'Rango de fechas'}</div>
        <div className="req-date">📅 {dateText}</div>
        <div className="req-reason"><span style={{color:'#6b7280'}}>Motivo: </span>{req.reason}</div>
        {isIncoming && req.status === 'pending' && (
          <div className="req-actions">
            <button className="req-action-btn btn-reject" onClick={() => respondToRequest(req.id, 'rejected')}>✕ Rechazar</button>
            <button className="req-action-btn btn-accept" onClick={() => handleAccept(req)}>✓ Aceptar</button>
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
