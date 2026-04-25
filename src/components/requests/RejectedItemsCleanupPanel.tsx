'use client'

import { useMemo } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { deleteRequest } from '@/lib/db'
import { deleteCollaboratorAssignment } from '@/lib/collaborator-assignments-db'
import { showToast } from '@/lib/toast'
import { formatDate } from '@/lib/utils'

export function RejectedItemsCleanupPanel() {
  const { user } = useAuth()
  const { requests, collaboratorAssignments, children, selectedChildId } = useAppStore()

  const child = useMemo(() => children.find(item => item.id === selectedChildId) ?? null, [children, selectedChildId])
  const isParentForSelectedChild = !!child && !!user?.uid && child.parents.includes(user.uid)
  const isCollaboratorForSelectedChild = !!child && !!user?.uid && !!child.collaborators?.includes(user.uid)

  const rejectedRequests = useMemo(() => {
    if (!user?.uid || !isParentForSelectedChild) return []
    return requests.filter(item => item.status === 'rejected')
  }, [requests, user?.uid, isParentForSelectedChild])

  const removableCollaboratorAssignments = useMemo(() => {
    if (!user?.uid) return []
    return collaboratorAssignments.filter(item => {
      const visibleToCollaborator = isCollaboratorForSelectedChild && item.collaboratorId === user.uid
      const visibleToParent = isParentForSelectedChild && (item.createdByParentId === user.uid || item.collaboratorId === user.uid)
      return (visibleToCollaborator || visibleToParent) && ['rejected', 'cancelled'].includes(item.status)
    })
  }, [collaboratorAssignments, user?.uid, isParentForSelectedChild, isCollaboratorForSelectedChild])

  const totalItems = rejectedRequests.length + removableCollaboratorAssignments.length
  if (!child || totalItems === 0) return null

  return (
    <div className="card" style={{ marginTop: 12, padding: 14, borderRadius: 20, background: 'linear-gradient(180deg, rgba(239,68,68,0.06) 0%, var(--bg-card) 100%)', border: '1px solid rgba(239,68,68,0.18)' }}>
      <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Limpieza</div>
      <div style={{ fontSize: 14, color: 'var(--text-strong)', fontWeight: 800, marginBottom: 4 }}>Elementos rechazados o cerrados</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>Puedes eliminar desde aquí cualquier solicitud rechazada y las asignaciones a colaboradores rechazadas o canceladas.</div>

      {rejectedRequests.length > 0 && (
        <div style={{ marginBottom: removableCollaboratorAssignments.length > 0 ? 10 : 0 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>Solicitudes rechazadas</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {rejectedRequests.map(item => (
              <div key={item.id} style={{ padding: '10px 12px', borderRadius: 16, border: '1px solid rgba(239,68,68,0.16)', background: 'var(--bg-card)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-strong)', fontWeight: 800 }}>{item.fromParentName}</div>
                  <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 800 }}>RECHAZADA</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>{item.type === 'single' ? formatDate(item.date!) : `${formatDate(item.startDate!)} → ${formatDate(item.endDate!)}`}</div>
                <button className="req-action-btn btn-reject" onClick={async () => {
                  await deleteRequest(item.id)
                  showToast({ message: 'Solicitud rechazada eliminada.', tone: 'success' })
                }}>Eliminar</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {removableCollaboratorAssignments.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>Asignaciones a colaboradores</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {removableCollaboratorAssignments.map(item => (
              <div key={item.id} style={{ padding: '10px 12px', borderRadius: 16, border: '1px solid rgba(239,68,68,0.16)', background: 'var(--bg-card)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-strong)', fontWeight: 800 }}>{item.collaboratorName}</div>
                  <div style={{ fontSize: 11, color: item.status === 'rejected' ? '#ef4444' : 'var(--text-muted)', fontWeight: 800 }}>{item.status === 'rejected' ? 'RECHAZADA' : 'CANCELADA'}</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>{formatDate(item.date)}{item.type === 'partial_slot' && item.startTime && item.endTime ? ` · ${item.startTime}-${item.endTime}` : ' · Día completo'}</div>
                <button className="req-action-btn btn-reject" onClick={async () => {
                  await deleteCollaboratorAssignment(item.id)
                  showToast({ message: 'Asignación eliminada.', tone: 'success' })
                }}>Eliminar</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
