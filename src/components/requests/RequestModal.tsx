'use client'
import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '@/store/app'
import { useAuth } from '@/lib/auth-context'
import { createChangeRequest, createNotification } from '@/lib/db'

interface Props { open: boolean; onClose: () => void; initialDate?: string | null }

export function RequestModal({ open, onClose, initialDate }: Props) {
  const { user } = useAuth()
  const { children, selectedChildId } = useAppStore()
  const child = useMemo(() => children.find(c => c.id === selectedChildId) ?? null, [children, selectedChildId])
  const otherParentId = useMemo(() => child?.parents.find(p => p !== user?.uid) ?? null, [child, user])
  const otherParentName = otherParentId ? (child?.parentNames?.[otherParentId] ?? 'El otro progenitor') : '—'

  const [type, setType] = useState<'single'|'range'>('single')
  const [date, setDate] = useState(initialDate ?? '')
  const [startDate, setStartDate] = useState(initialDate ?? '')
  const [endDate, setEndDate] = useState(initialDate ?? '')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!open) return
    if (initialDate) {
      setDate(initialDate)
      setStartDate(prev => prev || initialDate)
      setEndDate(prev => prev || initialDate)
    }
  }, [open, initialDate])

  if (!open) return null

  const isValid = reason.trim().length > 0 && (type === 'single' ? !!date : !!startDate && !!endDate && startDate <= endDate)
  const summaryDate = type === 'single' ? date : `${startDate}→${endDate}`

  const handleSubmit = async () => {
    if (!user || !child || !otherParentId || !reason.trim()) return
    setLoading(true)
    try {
      await createChangeRequest({ childId: child.id, fromParentId: user.uid, fromParentName: user.displayName ?? user.email ?? 'Progenitor', toParentId: otherParentId, type, ...(type === 'single' ? { date } : { startDate, endDate }), reason: reason.trim() })
      await createNotification({
        userId: otherParentId,
        childId: child.id,
        childName: child.name,
        type: 'pending_request',
        title: 'Nueva solicitud de cambio',
        body: `${user.displayName || user.email || 'El otro progenitor'} ha pedido un cambio de custodia (${summaryDate}).`,
        dateKey: `change-request:${child.id}:${summaryDate}:${Date.now()}`,
      })
      setSuccess(true)
      setTimeout(() => { onClose(); setSuccess(false) }, 1500)
    } catch(e) { console.error(e) } finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => { if(e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <div className="modal-title">Solicitar cambio de custodia</div>
            <div className="modal-sub">Se enviará a <span style={{color:'#60a5fa'}}>{otherParentName}</span></div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {success ? (
          <div className="success-state">
            <div className="success-icon">✅</div>
            <div className="success-title">Solicitud enviada</div>
            <div className="success-sub">{otherParentName} recibirá tu petición</div>
          </div>
        ) : (
          <>
            <div className="modal-body">
              <div style={{marginBottom:14}}>
                <div className="settings-label">Tipo de cambio</div>
                <div className="type-toggle">
                  {[{v:'single',l:'📅 Día concreto'},{v:'range',l:'↔ Rango de fechas'}].map(({v,l}) => (
                    <button key={v} className={`type-btn ${type===v?'active':''}`} onClick={() => {
                      setType(v as any)
                      if (v === 'range' && date) {
                        setStartDate(prev => prev || date)
                        setEndDate(prev => prev || date)
                      }
                    }}>{l}</button>
                  ))}
                </div>
              </div>

              <div style={{marginBottom:14}}>
                <div className="settings-label">{type==='single'?'Fecha':'Período'}</div>
                {type === 'single' ? (
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} className="settings-input" />
                ) : (
                  <div className="date-pair">
                    <div><div className="date-pair-label">Desde</div><input type="date" value={startDate} onChange={e => { const next = e.target.value; setStartDate(next); if (!endDate || endDate < next) setEndDate(next) }} className="settings-input" /></div>
                    <div><div className="date-pair-label">Hasta</div><input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} className="settings-input" /></div>
                  </div>
                )}
              </div>

              <div>
                <div className="settings-label">📝 Motivo / Observaciones</div>
                <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Explica el motivo del cambio..." rows={3} className="settings-textarea" />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-primary btn-outline" style={{flex:1}} onClick={onClose}>Cancelar</button>
              <button style={{flex:1,padding:'11px',borderRadius:12,border:'none',background:(!isValid||loading)?'rgba(255,255,255,0.08)':'#3B82F6',color:(!isValid||loading)?'#6b7280':'#fff',fontSize:13,fontWeight:700,cursor:(!isValid||loading)?'not-allowed':'pointer'}} onClick={handleSubmit} disabled={!isValid||loading}>
                {loading ? 'Enviando...' : 'Enviar solicitud'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
