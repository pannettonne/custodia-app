'use client'

import { useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { cancelCollaboratorAssignment, respondToCollaboratorAssignment } from '@/lib/collaborator-assignments-db'
import { createNotification } from '@/lib/db'
import { formatDate } from '@/lib/utils'
import type { Child } from '@/types'

function statusText(status: string) {
  if (status === 'accepted') return 'Aceptada'
  if (status === 'rejected') return 'Rechazada'
  if (status === 'cancelled') return 'Cancelada'
  return 'Pendiente'
}

function statusColor(status: string) {
  if (status === 'accepted') return '#10b981'
  if (status === 'rejected') return '#ef4444'
  if (status === 'cancelled') return '#9ca3af'
  return '#f59e0b'
}

export function CollaboratorAssignmentsSection({ child, isParent }: { child: Child; isParent: boolean }) {
  const { user } = useAuth()
  const { collaboratorAssignments } = useAppStore()
  const [busyId, setBusyId] = useState<string | null>(null)

  const items = useMemo(() => {
    if (isParent) return collaboratorAssignments
    return collaboratorAssignments.filter(item => item.collaboratorId === user?.uid)
  }, [collaboratorAssignments, isParent, user?.uid])

  const handleRespond = async (assignmentId: string, accepted: boolean, createdByParentId: string, collaboratorName: string) => {
    if (!user) return
    setBusyId(assignmentId)
    try {
      await respondToCollaboratorAssignment(assignmentId, accepted ? 'accepted' : 'rejected')
      await createNotification({
        userId: createdByParentId,
        childId: child.id,
        childName: child.name,
        type: 'event_assignment_response',
        title: accepted ? 'Asignación aceptada' : 'Asignación rechazada',
        body: `${collaboratorName} ha ${accepted ? 'aceptado' : 'rechazado'} la asignación recibida.`,
        dateKey: `collaborator-assignment-response:${assignmentId}`,
        targetTab: 'settings',
      })
    } finally {
      setBusyId(null)
    }
  }

  const handleCancel = async (assignmentId: string, collaboratorId: string, collaboratorName: string) => {
    if (!user) return
    setBusyId(assignmentId)
    try {
      await cancelCollaboratorAssignment(assignmentId)
      await createNotification({
        userId: collaboratorId,
        childId: child.id,
        childName: child.name,
        type: 'event_assignment_response',
        title: 'Asignación cancelada',
        body: `${user.displayName || user.email || 'Un progenitor'} ha cancelado la asignación de ${collaboratorName}.`,
        dateKey: `collaborator-assignment-cancel:${assignmentId}`,
        targetTab: 'settings',
      })
    } finally {
      setBusyId(null)
    }
  }

  if (items.length === 0) {
    return (
      <div className="card">
        <div style={{ fontSize: 13, fontWeight: 700, color: '#9ca3af', marginBottom: 12 }}>🗂️ Asignaciones</div>
        <div style={{ fontSize: 12, color: '#6b7280' }}>{isParent ? 'Todavía no hay asignaciones a colaboradores para este menor.' : 'No tienes asignaciones recibidas para este menor.'}</div>
      </div>
    )
  }

  return (
    <div className="card">
      <div style={{ fontSize: 13, fontWeight: 700, color: '#9ca3af', marginBottom: 12 }}>🗂️ {isParent ? 'Asignaciones a colaboradores' : 'Asignaciones recibidas'}</div>
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {items.map(item => {
          const dateLabel = item.type === 'partial_slot' && item.startTime && item.endTime
            ? `${formatDate(item.date)} · ${item.startTime}-${item.endTime}`
            : `${formatDate(item.date)} · Día completo`
          return (
            <div key={item.id} style={{ padding:'12px', borderRadius:12, background:'var(--bg-soft)', border:'1px solid var(--border)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', gap:10, alignItems:'flex-start' }}>
                <div>
                  <div style={{ color:'var(--text-strong)', fontSize:13, fontWeight:700 }}>{isParent ? item.collaboratorName : item.createdByParentName}</div>
                  <div style={{ color:'#6b7280', fontSize:11, marginTop:3 }}>{dateLabel}</div>
                  {item.notes ? <div style={{ color:'var(--text-secondary)', fontSize:12, marginTop:6 }}>{item.notes}</div> : null}
                </div>
                <div style={{ fontSize:11, fontWeight:800, color: statusColor(item.status) }}>{statusText(item.status).toUpperCase()}</div>
              </div>

              {item.status === 'pending' && (
                <div style={{ display:'flex', gap:8, marginTop:12, flexWrap:'wrap' }}>
                  {isParent ? (
                    <button onClick={() => handleCancel(item.id, item.collaboratorId, item.collaboratorName)} disabled={busyId === item.id} style={{ padding:'8px 10px', borderRadius:10, border:'1px solid var(--border)', background:'var(--bg-card)', color:'#ef4444', fontSize:12, fontWeight:700, cursor: busyId === item.id ? 'not-allowed' : 'pointer', opacity: busyId === item.id ? 0.6 : 1 }}>Cancelar</button>
                  ) : (
                    <>
                      <button onClick={() => handleRespond(item.id, false, item.createdByParentId, user?.displayName || user?.email || 'Colaborador')} disabled={busyId === item.id} style={{ padding:'8px 10px', borderRadius:10, border:'1px solid var(--border)', background:'var(--bg-card)', color:'#ef4444', fontSize:12, fontWeight:700, cursor: busyId === item.id ? 'not-allowed' : 'pointer', opacity: busyId === item.id ? 0.6 : 1 }}>Rechazar</button>
                      <button onClick={() => handleRespond(item.id, true, item.createdByParentId, user?.displayName || user?.email || 'Colaborador')} disabled={busyId === item.id} style={{ padding:'8px 10px', borderRadius:10, border:'1px solid transparent', background:'#10b981', color:'#fff', fontSize:12, fontWeight:700, cursor: busyId === item.id ? 'not-allowed' : 'pointer', opacity: busyId === item.id ? 0.6 : 1 }}>Aceptar</button>
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
