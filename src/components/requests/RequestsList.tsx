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

  return (
    <div>
      {incoming.length > 0 && <><div className="section-title">Recibidas ({incoming.length})</div>{incoming.map(r => <Card key={r.id} req={r} isIncoming />)}</>}
      {outgoing.length > 0 && <><div className="section-title" style={{marginTop:16}}>Enviadas ({outgoing.length})</div>{outgoing.map(r => <Card key={r.id} req={r} isIncoming={false} />)}</>}
    </div>
  )
}
