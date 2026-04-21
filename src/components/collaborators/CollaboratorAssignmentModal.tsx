'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { createCollaboratorAssignment } from '@/lib/collaborator-assignments-db'
import { createNotification } from '@/lib/db'
import { showToast } from '@/lib/toast'
import type { CollaboratorAssignmentType } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  initialDate?: string | null
  baseParentId?: string | null
}

export function CollaboratorAssignmentModal({ open, onClose, initialDate, baseParentId }: Props) {
  const { user } = useAuth()
  const { children, selectedChildId } = useAppStore()
  const child = useMemo(() => children.find(c => c.id === selectedChildId) ?? null, [children, selectedChildId])
  const collaboratorIds = child?.collaborators || []

  const [collaboratorId, setCollaboratorId] = useState('')
  const [type, setType] = useState<CollaboratorAssignmentType>('full_day')
  const [date, setDate] = useState(initialDate ?? '')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('14:00')
  const [notes, setNotes] = useState('')
  const [locationName, setLocationName] = useState('')
  const [locationAddress, setLocationAddress] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    const nextDate = initialDate ?? ''
    setDate(nextDate)
    setType('full_day')
    setNotes('')
    setLocationName('')
    setLocationAddress('')
    const firstCollaborator = child?.collaborators?.[0] || ''
    setCollaboratorId(firstCollaborator)
    setStartTime('09:00')
    setEndTime('14:00')
    setLoading(false)
  }, [open, initialDate, child?.id])

  if (!open) return null

  const selectedCollaboratorName = collaboratorId ? child?.collaboratorNames?.[collaboratorId] || 'Colaborador' : ''
  const isValid = !!user && !!child && !!baseParentId && !!date && !!collaboratorId && (type === 'full_day' || (startTime && endTime && startTime < endTime))
  const summaryLocation = locationName.trim() || locationAddress.trim()

  const handleSubmit = async () => {
    if (!user || !child || !baseParentId || !collaboratorId) return
    setLoading(true)
    try {
      await createCollaboratorAssignment({
        childId: child.id,
        createdByParentId: user.uid,
        createdByParentName: user.displayName || user.email || 'Progenitor',
        baseParentId,
        collaboratorId,
        collaboratorName: child.collaboratorNames?.[collaboratorId] || 'Colaborador',
        collaboratorLabel: child.collaboratorLabels?.[collaboratorId],
        type,
        date,
        startTime: type === 'partial_slot' ? startTime : undefined,
        endTime: type === 'partial_slot' ? endTime : undefined,
        notes: notes.trim() || undefined,
        locationName: locationName.trim() || undefined,
        locationAddress: locationAddress.trim() || undefined,
      })
      await createNotification({
        userId: collaboratorId,
        childId: child.id,
        childName: child.name,
        type: 'event_assignment_pending',
        title: 'Nueva asignacion recibida',
        body: `${user.displayName || user.email || 'Un progenitor'} te ha enviado una asignacion para ${child.name}${summaryLocation ? ` · ${summaryLocation}` : ''}.`,
        dateKey: `collaborator-assignment:${child.id}:${date}:${Date.now()}`,
        targetTab: 'requests',
        targetDate: date,
      })
      showToast({ message: `Asignacion enviada a ${selectedCollaboratorName}.`, tone: 'success' })
      onClose()
    } catch (error: any) {
      showToast({ message: error?.message || 'No se pudo crear la asignacion.', tone: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <div className="modal-title">Asignar colaborador</div>
            <div className="modal-sub">Envia una asignacion puntual a un familiar o cuidador</div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div style={{ marginBottom: 14 }}>
            <div className="settings-label">Colaborador</div>
            <select value={collaboratorId} onChange={e => setCollaboratorId(e.target.value)} className="settings-select">
              {collaboratorIds.map(id => (
                <option key={id} value={id}>{child?.collaboratorNames?.[id] || 'Colaborador'}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div className="settings-label">Tipo</div>
            <div className="type-toggle">
              <button className={`type-btn ${type === 'full_day' ? 'active' : ''}`} onClick={() => setType('full_day')}>Dia completo</button>
              <button className={`type-btn ${type === 'partial_slot' ? 'active' : ''}`} onClick={() => setType('partial_slot')}>Tramo parcial</button>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div className="settings-label">Fecha</div>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="settings-input" />
          </div>

          {type === 'partial_slot' && (
            <div style={{ marginBottom: 14 }}>
              <div className="settings-label">Horario</div>
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
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <div className="settings-label">Localizacion (opcional)</div>
            <input value={locationName} onChange={e => setLocationName(e.target.value)} placeholder="Nombre del lugar o punto de encuentro" className="settings-input" style={{ marginBottom:8 }} />
            <input value={locationAddress} onChange={e => setLocationAddress(e.target.value)} placeholder="Direccion o referencia" className="settings-input" />
          </div>

          <div>
            <div className="settings-label">Observaciones</div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Recoger del cole, llevar mochila, etc." rows={3} className="settings-textarea" />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-primary btn-outline" style={{ flex:1 }} onClick={onClose}>Cancelar</button>
          <button style={{ flex:1,padding:'11px',borderRadius:12,border:'none',background:(!isValid||loading)?'rgba(255,255,255,0.08)':'#8B5CF6',color:(!isValid||loading)?'#6b7280':'#fff',fontSize:13,fontWeight:700,cursor:(!isValid||loading)?'not-allowed':'pointer' }} onClick={handleSubmit} disabled={!isValid || loading}>{loading ? 'Enviando...' : 'Enviar asignacion'}</button>
        </div>
      </div>
    </div>
  )
}
