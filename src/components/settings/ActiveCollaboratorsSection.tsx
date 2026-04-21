'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { revokeCollaborator, setCollaboratorDocumentAccess, setCollaboratorGlobalCalendarApproval } from '@/lib/collaborators-db'
import type { Child } from '@/types'

function labelText(value?: string) {
  if (value === 'caregiver') return 'Cuidador'
  if (value === 'family') return 'Familiar'
  return 'Otro'
}

function ActionButton({ active, disabled, onClick, children }: { active?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding:'8px 10px',
        borderRadius:10,
        border:'1px solid',
        borderColor: active ? 'transparent' : 'var(--border)',
        background: active ? '#10b981' : 'var(--bg-card)',
        color: active ? '#fff' : 'var(--text-secondary)',
        fontSize:12,
        fontWeight:700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  )
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

  const handleUnlink = async (collaboratorId: string) => {
    setBusyKey(`unlink-${collaboratorId}`)
    try {
      await revokeCollaborator(child.id, collaboratorId)
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
            const name = child.collaboratorNames?.[uid] || 'Colaborador'
            const docEnabled = !!child.collaboratorDocumentAccess?.[uid]
            const approvals = child.collaboratorCalendarApprovedBy?.[uid] || []
            const currentParentApproved = !!user?.uid && approvals.includes(user.uid)
            const fullCalendarEnabled = child.collaboratorCalendarAccess?.[uid] === 'all'
            return (
              <div key={uid} style={{ padding:'12px', borderRadius:12, background:'var(--bg-soft)', border:'1px solid var(--border)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', gap:10, alignItems:'flex-start' }}>
                  <div>
                    <div style={{ color:'var(--text-strong)', fontSize:12, fontWeight:700 }}>{name}</div>
                    <div style={{ color:'#6b7280', fontSize:11, marginTop:3 }}>{labelText(child.collaboratorLabels?.[uid])}</div>
                    <div style={{ color:'#6b7280', fontSize:11, marginTop:3 }}>{child.collaboratorEmails?.[collaboratorIds.indexOf(uid)] || ''}</div>
                  </div>
                  <button
                    onClick={() => handleUnlink(uid)}
                    disabled={busyKey === `unlink-${uid}`}
                    style={{ background:'none', border:'none', color:'#ef4444', fontSize:12, fontWeight:800, cursor: busyKey === `unlink-${uid}` ? 'not-allowed' : 'pointer', opacity: busyKey === `unlink-${uid}` ? 0.6 : 1 }}
                  >
                    {busyKey === `unlink-${uid}` ? 'Desvinculando...' : 'Desvincular'}
                  </button>
                </div>

                <div style={{ display:'grid', gap:10, marginTop:12 }}>
                  <div>
                    <div style={{ fontSize:12, color:'var(--text-secondary)', marginBottom:6 }}>Acceso a documentos</div>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                      <ActionButton active={docEnabled} disabled={busyKey === `docs-${uid}`} onClick={() => handleDocumentToggle(uid, true)}>Permitir</ActionButton>
                      <ActionButton active={!docEnabled} disabled={busyKey === `docs-${uid}`} onClick={() => handleDocumentToggle(uid, false)}>Bloquear</ActionButton>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize:12, color:'var(--text-secondary)', marginBottom:6 }}>Mi aprobación para ver todo el calendario</div>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                      <ActionButton active={currentParentApproved} disabled={busyKey === `calendar-${uid}`} onClick={() => handleCalendarToggle(uid, true)}>Aprobar</ActionButton>
                      <ActionButton active={!currentParentApproved} disabled={busyKey === `calendar-${uid}`} onClick={() => handleCalendarToggle(uid, false)}>Quitar aprobación</ActionButton>
                    </div>
                  </div>

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
