'use client'

import type { Child } from '@/types'

function labelText(value?: string) {
  if (value === 'caregiver') return 'Cuidador'
  if (value === 'family') return 'Familiar'
  return 'Otro'
}

export function ActiveCollaboratorsSection({ child }: { child: Child }) {
  const collaboratorIds = child.collaborators || []

  return (
    <div className="card">
      <div style={{ fontSize: 13, fontWeight: 700, color: '#9ca3af', marginBottom: 12 }}>🤝 Colaboradores activos</div>
      {collaboratorIds.length === 0 ? (
        <div style={{ fontSize: 12, color: '#6b7280' }}>Todavía no hay colaboradores aceptados para este menor.</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {collaboratorIds.map(uid => (
            <div key={uid} style={{ padding:'10px 12px', borderRadius:12, background:'var(--bg-soft)', border:'1px solid var(--border)' }}>
              <div style={{ color:'var(--text-strong)', fontSize:12, fontWeight:700 }}>{child.collaboratorNames?.[uid] || 'Colaborador'}</div>
              <div style={{ color:'#6b7280', fontSize:11, marginTop:3 }}>{labelText(child.collaboratorLabels?.[uid])}</div>
              <div style={{ color:'#6b7280', fontSize:11, marginTop:3 }}>{child.collaboratorEmails?.[collaboratorIds.indexOf(uid)] || ''}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
