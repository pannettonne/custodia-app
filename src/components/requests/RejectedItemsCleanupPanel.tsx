'use client'

import { useMemo } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { deleteRequest } from '@/lib/db'
import { deleteCollaboratorAssignment } from '@/lib/collaborator-assignments-db'
import { showToast } from '@/lib/toast'
import { formatDate } from '@/lib/utils'
import { AvailabilityBlocksPanel } from './AvailabilityBlocksPanel'

export function RejectedItemsCleanupPanel({ embedded = false }: { embedded?: boolean } = {}) {
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
  if (!embedded || !child) return null

  return (
    <div className="blocks-cleanup-panel">
      <AvailabilityBlocksPanel />
      {totalItems > 0 && (
        <div className="card blocks-cleanup-card">
          <div className="blocks-cleanup-kicker">Limpieza</div>
          <div className="blocks-cleanup-title">Elementos rechazados o cerrados</div>
          <div className="blocks-cleanup-subtitle">Puedes eliminar desde aquí cualquier solicitud rechazada y las asignaciones a colaboradores rechazadas o canceladas.</div>

          {rejectedRequests.length > 0 && (
            <div style={{ marginBottom: removableCollaboratorAssignments.length > 0 ? 10 : 0 }}>
              <div className="blocks-cleanup-section-title">Solicitudes rechazadas</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {rejectedRequests.map(item => (
                  <div key={item.id} className="blocks-cleanup-item">
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
              <div className="blocks-cleanup-section-title">Asignaciones a colaboradores</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {removableCollaboratorAssignments.map(item => (
                  <div key={item.id} className="blocks-cleanup-item">
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
      )}
    </div>
  )
}
