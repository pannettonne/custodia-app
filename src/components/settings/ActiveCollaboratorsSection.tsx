'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { setCollaboratorDocumentAccess, setCollaboratorGlobalCalendarApproval } from '@/lib/collaborators-db'
import type { Child } from '@/types'

function labelText(value?: string) {
  if (value === 'caregiver') return 'Cuidador'
  if (value === 'family') return 'Familiar'
  return 'Otro'
}

export function ActiveCollaboratorsSection({ child }: { child: Child }) {
  const { user } = useAuth()
  const collaboratorIds = child.collaborators || []
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const handleDocumentToggle = async (collaboratorId: string, enabled: boolean) => {
    setBusyKey(`docs-${collaboratorId}`)
    try {
      await setCollaboratorDocumentAccess(child.id, collaboratorId, enabled)
    } finally {
      setBusyKey(null)
    }
  }

  const handleCalendarToggle = async (collaboratorId: string, enabled: boolean) => {
    if (!user?.uid) return
    setBusyKey(`calendar-${collaboratorId}`)
    try {
      await setCollaboratorGlobalCalendarApproval(child.id, collaboratorId, user.uid, enabled)
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <div className="card">
      <div style={{ fontSize: 13, fontWeight: 700, color: '#9ca3af', marginBottom: 12 }}>🤝 Colaboradores activos</div>
      {collaboratorIds.length === 0 ? (
        <div style={{ fontSize: 12, color: '#6b7280' }}>Todavía no hay colaboradores aceptados para este menor.</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {collaboratorIds.map(uid => {
            const docEnabled = !!child.collaboratorDocumentAccess?.[uid]
            const approvals = child.collaboratorCalendarApprovedBy?.[uid] || []
            const currentParentApproved = !!user?.uid && approvals.includes(user.uid)
            const fullCalendarEnabled = child.collaboratorCalendarAccess?.[uid] === 'all'
            return (
              <div key={uid} style={{ padding:'12px', borderRadius:12, background:'var(--bg-soft)', border:'1px solid var(--border)' }}>
                <div style={{ color:'var(--text-strong)', fontSize:12, fontWeight:700 }}>{child.collaboratorNames?.[uid] || 'Colaborador'}</div>
                <div style={{ color:'#6b7280', fontSize:11, marginTop:3 }}>{labelText(child.collaboratorLabels?.[uid])}</div>
                <div style={{ color:'#6b7280', fontSize:11, marginTop:3 }}>{child.collaboratorEmails?.[collaboratorIds.indexOf(uid)] || ''}</div>

                <div style={{ display:'grid', gap:8, marginTop:10 }}>
                  <label style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, fontSize:12, color:'var(--text-secondary)' }}>
                    <span>Acceso a documentos</span>
                    <input type="checkbox" checked={docEnabled} disabled={busyKey === `docs-${uid}`} onChange={e => handleDocumentToggle(uid, e.target.checked)} />
                  </label>

                  <label style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, fontSize:12, color:'var(--text-secondary)' }}>
                    <span>Mi aprobación para ver todo el calendario</span>
                    <input type="checkbox" checked={currentParentApproved} disabled={busyKey === `calendar-${uid}`} onChange={e => handleCalendarToggle(uid, e.target.checked)} />
                  </label>

                  <div style={{ fontSize:11, color: fullCalendarEnabled ? '#10b981' : '#6b7280' }}>
                    {fullCalendarEnabled ? 'Calendario completo aprobado por ambos progenitores.' : `Pendiente de aprobación conjunta (${approvals.length}/${child.parents.length}).`}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
