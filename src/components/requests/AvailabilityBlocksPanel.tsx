'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { createAvailabilityBlock, deleteAvailabilityBlock, subscribeToAvailabilityBlocks } from '@/lib/availability-blocks-db'
import { formatAvailabilityBlockLabel } from '@/lib/availability-blocks'
import { showToast } from '@/lib/toast'
import type { AvailabilityBlock, AvailabilityBlockType } from '@/types'

export function AvailabilityBlocksPanel() {
  const { user } = useAuth()
  const { children, selectedChildId } = useAppStore()
  const child = useMemo(() => children.find(item => item.id === selectedChildId) ?? null, [children, selectedChildId])
  const [items, setItems] = useState<AvailabilityBlock[]>([])
  const [type, setType] = useState<AvailabilityBlockType>('full_day')
  const [date, setDate] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('14:00')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!child?.id) {
      setItems([])
      return
    }
    return subscribeToAvailabilityBlocks(child.id, setItems)
  }, [child?.id])

  useEffect(() => {
    const seed = new Date().toISOString().slice(0, 10)
    setDate(current => current || seed)
    setStartDate(current => current || seed)
    setEndDate(current => current || seed)
  }, [])

  const myBlocks = useMemo(() => items.filter(item => item.userId === user?.uid), [items, user?.uid])
  const otherBlocks = useMemo(() => items.filter(item => item.userId !== user?.uid), [items, user?.uid])
  const isParent = !!child && !!user?.uid && child.parents.includes(user.uid)
  const isCollaborator = !!child && !!user?.uid && !!child.collaborators?.includes(user.uid)
  const canUse = !!child && !!user?.uid && (isParent || isCollaborator)

  if (!canUse) return null

  const isValid = type === 'partial_slot'
    ? !!date && !!startTime && !!endTime && startTime < endTime
    : type === 'date_range'
      ? !!startDate && !!endDate && startDate <= endDate
      : !!date

  const handleCreate = async () => {
    if (!user || !child || !isValid) return
    setSaving(true)
    try {
      await createAvailabilityBlock({
        childId: child.id,
        userId: user.uid,
        userName: user.displayName || user.email || 'Usuario',
        ownerRole: isParent ? 'parent' : 'collaborator',
        type,
        date: type === 'full_day' || type === 'partial_slot' ? date : undefined,
        startDate: type === 'date_range' ? startDate : undefined,
        endDate: type === 'date_range' ? endDate : undefined,
        startTime: type === 'partial_slot' ? startTime : undefined,
        endTime: type === 'partial_slot' ? endTime : undefined,
        note: note.trim() || undefined,
      })
      setNote('')
      showToast({ message: 'Bloqueo guardado.', tone: 'success' })
    } catch (error: any) {
      showToast({ message: error?.message || 'No se pudo guardar el bloqueo.', tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const renderBlockCard = (item: AvailabilityBlock, own: boolean) => (
    <div key={item.id} style={{ padding:'10px 12px', borderRadius:16, border:'1px solid var(--border)', background:'var(--bg-card)' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8, marginBottom:6 }}>
        <div style={{ fontSize:13, color:'var(--text-strong)', fontWeight:800 }}>{own ? 'Tu bloqueo' : item.userName}</div>
        <div style={{ fontSize:10, color: own ? '#f59e0b' : '#60a5fa', fontWeight:800, textTransform:'uppercase' }}>{item.ownerRole === 'parent' ? 'progenitor' : 'colaborador'}</div>
      </div>
      <div style={{ fontSize:12, color:'var(--text-secondary)', marginBottom: own || item.note ? 8 : 0 }}>{formatAvailabilityBlockLabel(item)}</div>
      {item.note ? <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom: own ? 8 : 0 }}>{item.note}</div> : null}
      {own ? (
        <button className="req-action-btn btn-reject" onClick={async () => {
          await deleteAvailabilityBlock(item.id)
          showToast({ message: 'Bloqueo eliminado.', tone: 'success' })
        }}>Eliminar</button>
      ) : null}
    </div>
  )

  return (
    <div className="card" style={{ marginBottom: 12, padding: 14, borderRadius: 20, background:'linear-gradient(180deg, rgba(245,158,11,0.08) 0%, var(--bg-card) 100%)', border:'1px solid rgba(245,158,11,0.18)' }}>
      <div style={{ fontSize:11, color:'#f59e0b', fontWeight:800, textTransform:'uppercase', letterSpacing:0.4, marginBottom:6 }}>Bloqueos personales</div>
      <div style={{ fontSize:14, color:'var(--text-strong)', fontWeight:800, marginBottom:4 }}>Indica cuándo no te pueden asignar</div>
      <div style={{ fontSize:12, color:'var(--text-secondary)', marginBottom:12 }}>Todos ven estos bloqueos y la app impedirá enviar solicitudes o asignaciones que choquen con ellos.</div>

      <div style={{ display:'grid', gap:10, marginBottom:12 }}>
        <div>
          <div className="settings-label">Tipo de bloqueo</div>
          <div className="type-toggle">
            <button className={`type-btn ${type === 'full_day' ? 'active' : ''}`} onClick={() => setType('full_day')}>📅 Día completo</button>
            <button className={`type-btn ${type === 'date_range' ? 'active' : ''}`} onClick={() => setType('date_range')}>↔ Período</button>
            <button className={`type-btn ${type === 'partial_slot' ? 'active' : ''}`} onClick={() => setType('partial_slot')}>⏰ Tramo parcial</button>
          </div>
        </div>

        {(type === 'full_day' || type === 'partial_slot') && (
          <div>
            <div className="settings-label">Fecha</div>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="settings-input" />
          </div>
        )}

        {type === 'date_range' && (
          <div className="date-pair">
            <div>
              <div className="date-pair-label">Desde</div>
              <input type="date" value={startDate} onChange={e => { const next = e.target.value; setStartDate(next); if (!endDate || endDate < next) setEndDate(next) }} className="settings-input" />
            </div>
            <div>
              <div className="date-pair-label">Hasta</div>
              <input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} className="settings-input" />
            </div>
          </div>
        )}

        {type === 'partial_slot' && (
          <div className="date-pair">
            <div>
              <div className="date-pair-label">Desde</div>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="settings-input" />
            </div>
            <div>
              <div className="date-pair-label">Hasta</div>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="settings-input" />
            </div>
          </div>
        )}

        <div>
          <div className="settings-label">Nota opcional</div>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} className="settings-textarea" placeholder="Médico, viaje, trabajo, no disponible..." />
        </div>

        <button className="req-action-btn btn-accept" disabled={!isValid || saving} onClick={handleCreate} style={{ opacity: !isValid || saving ? 0.6 : 1, cursor: !isValid || saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Guardando...' : 'Guardar bloqueo'}</button>
      </div>

      {myBlocks.length > 0 && (
        <div style={{ marginBottom: otherBlocks.length > 0 ? 10 : 0 }}>
          <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:800, textTransform:'uppercase', letterSpacing:0.4, marginBottom:8 }}>Tus bloqueos</div>
          <div style={{ display:'grid', gap:8 }}>{myBlocks.map(item => renderBlockCard(item, true))}</div>
        </div>
      )}

      {otherBlocks.length > 0 && (
        <div>
          <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:800, textTransform:'uppercase', letterSpacing:0.4, marginBottom:8 }}>Bloqueos del resto</div>
          <div style={{ display:'grid', gap:8 }}>{otherBlocks.map(item => renderBlockCard(item, false))}</div>
        </div>
      )}
    </div>
  )
}
