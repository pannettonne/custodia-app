'use client'

import { useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { createCollaboratorInvitation } from '@/lib/collaborators-db'
import type { Child, CollaboratorLabel, Invitation } from '@/types'

const LABEL_OPTIONS: Array<{ value: CollaboratorLabel; label: string }> = [
  { value: 'caregiver', label: 'Cuidador' },
  { value: 'family', label: 'Familiar' },
  { value: 'other', label: 'Otro' },
]

function labelText(value?: CollaboratorLabel) {
  return LABEL_OPTIONS.find(option => option.value === value)?.label || 'Colaborador'
}

export function CollaboratorInviteSection({ child, invitations }: { child: Child; invitations: Invitation[] }) {
  const { user } = useAuth()
  const [email, setEmail] = useState('')
  const [label, setLabel] = useState<CollaboratorLabel>('caregiver')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const sentInvitations = useMemo(
    () => invitations.filter(inv => inv.childId === child.id && inv.inviteType === 'collaborator'),
    [invitations, child.id]
  )

  const handleInvite = async () => {
    if (!user || !email.trim()) return
    setLoading(true)
    setError('')
    try {
      await createCollaboratorInvitation({
        childId: child.id,
        childName: child.name,
        fromEmail: user.email?.toLowerCase() ?? '',
        fromName: user.displayName ?? user.email ?? 'Progenitor',
        toEmail: email.trim().toLowerCase(),
        inviteType: 'collaborator',
        collaboratorLabel: label,
      })
      setEmail('')
    } catch (e: any) {
      setError(e?.message || 'No se pudo enviar la invitación')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card">
      <div style={{ fontSize: 13, fontWeight: 700, color: '#9ca3af', marginBottom: 12 }}>🧑‍🤝‍🧑 Invitar colaborador</div>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>
        Añade un cuidador, familiar u otra persona con acceso limitado.
      </div>
      <select value={label} onChange={e => setLabel(e.target.value as CollaboratorLabel)} className="settings-select" style={{ marginBottom: 10 }}>
        {LABEL_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@ejemplo.com" className="settings-input" style={{ marginBottom: 10 }} />
      <button
        style={{ width:'100%', padding:'11px', borderRadius:12, border:'none', background:(!email.includes('@')||loading)?'rgba(255,255,255,0.08)':'#14b8a6', color:(!email.includes('@')||loading)?'#6b7280':'#fff', fontSize:13, fontWeight:700, cursor:(!email.includes('@')||loading)?'not-allowed':'pointer' }}
        onClick={handleInvite}
        disabled={!email.includes('@')||loading}
      >
        {loading ? 'Enviando...' : 'Invitar colaborador'}
      </button>
      {error && <div style={{ marginTop:10, color:'#fca5a5', fontSize:12 }}>{error}</div>}
      {sentInvitations.length > 0 && (
        <div style={{ marginTop:14 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#9ca3af', marginBottom:8 }}>Colaboradores invitados</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {sentInvitations.map(inv => (
              <div key={inv.id} style={{ padding:'10px 12px', borderRadius:12, background:'var(--bg-soft)', border:'1px solid var(--border)' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                  <div>
                    <div style={{ color:'var(--text-strong)', fontSize:12 }}>{inv.toEmail}</div>
                    <div style={{ color:'#6b7280', fontSize:11 }}>{labelText(inv.collaboratorLabel)}</div>
                  </div>
                  <div style={{ color: inv.status === 'pending' ? '#fbbf24' : inv.status === 'accepted' ? '#10b981' : inv.status === 'cancelled' ? '#9ca3af' : '#f87171', fontSize:11, fontWeight:700 }}>
                    {inv.status.toUpperCase()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
