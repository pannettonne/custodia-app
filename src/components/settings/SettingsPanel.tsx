'use client'
import { useState, useMemo } from 'react'
import { useAppStore } from '@/store/app'
import { useAuth } from '@/lib/auth-context'
import { createChild, createInvitation, acceptInvitation, setPattern } from '@/lib/db'
import { PARENT_COLORS, PATTERN_LABELS } from '@/lib/utils'
import type { Child } from '@/types'

export function SettingsPanel() {
  const { user } = useAuth()
  const { children, selectedChildId, invitations, pattern } = useAppStore()
  const child = useMemo(() => children.find(c => c.id === selectedChildId) ?? null, [children, selectedChildId])
  return (
    <div>
      {invitations.length > 0 && <PendingInvitations invitations={invitations} />}
      <ChildSection child={child} />
      {child && <PatternSection child={child} />}
      {child && child.parents.length < 2 && <InviteSection child={child} />}
      {child && child.parents.length >= 2 && <ParentsInfo child={child} />}
    </div>
  )
}

function PendingInvitations({ invitations }: { invitations: any[] }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState<string|null>(null)
  const handleAccept = async (inv: any) => {
    if (!user) return; setLoading(inv.id)
    try { await acceptInvitation(inv, user.uid, user.displayName ?? user.email ?? 'Progenitor') } finally { setLoading(null) }
  }
  return (
    <div className="invite-pending">
      <div className="invite-pending-title">📨 Invitaciones recibidas</div>
      {invitations.map(inv => (
        <div key={inv.id} className="invite-pending-row">
          <div>
            <div className="invite-pending-text">{inv.fromName} te invita a gestionar a <strong>{inv.childName}</strong></div>
            <div className="invite-pending-sub">{inv.fromEmail}</div>
          </div>
          <button className="btn-accept-invite" disabled={loading === inv.id} onClick={() => handleAccept(inv)}>{loading === inv.id ? '...' : 'Aceptar'}</button>
        </div>
      ))}
    </div>
  )
}

function ChildSection({ child }: { child: Child|null }) {
  const { user } = useAuth()
  const { children, selectedChildId, setSelectedChildId } = useAppStore()
  const [show, setShow] = useState(false)
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [color, setColor] = useState(PARENT_COLORS[0])
  const [loading, setLoading] = useState(false)

  const handleCreate = async () => {
    if (!user || !name.trim()) return; setLoading(true)
    try {
      const id = await createChild({ name: name.trim(), birthDate, createdBy: user.uid, parents: [user.uid], parentEmails: [user.email ?? ''], parentNames: { [user.uid]: user.displayName ?? user.email ?? 'Yo' }, parentColors: { [user.uid]: color } })
      setSelectedChildId(id); setShow(false); setName('')
    } finally { setLoading(false) }
  }

  return (
    <div className="card">
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
        <div style={{display:'flex',alignItems:'center',gap:8,fontSize:13,fontWeight:700,color:'#9ca3af'}}>👶 Menor</div>
        {!show && <button onClick={() => setShow(true)} style={{fontSize:12,color:'#3B82F6',background:'none',border:'none',cursor:'pointer',fontWeight:600}}>+ Añadir menor</button>}
      </div>

      {children.map(c => (
        <button key={c.id} className={`child-item ${selectedChildId===c.id?'selected':''}`} onClick={() => setSelectedChildId(c.id)}>
          <div className="child-item-avatar">{c.name[0]}</div>
          <div><div className="child-item-name">{c.name}</div><div className="child-item-sub">{c.parents.length} progenitor(es)</div></div>
        </button>
      ))}

      {show && (
        <div style={{marginTop:12,paddingTop:12,borderTop:'1px solid rgba(255,255,255,0.08)'}}>
          <div style={{marginBottom:10}}><div className="settings-label">Nombre del menor</div><input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre" className="settings-input" /></div>
          <div style={{marginBottom:10}}><div className="settings-label">Fecha de nacimiento (opcional)</div><input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} className="settings-input" /></div>
          <div style={{marginBottom:12}}>
            <div className="settings-label">Tu color en el calendario</div>
            <div className="color-swatches">{PARENT_COLORS.map(c => <div key={c} className={`color-swatch ${color===c?'selected':''}`} style={{background:c}} onClick={() => setColor(c)} />)}</div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button className="btn-primary btn-outline" style={{flex:1}} onClick={() => setShow(false)}>Cancelar</button>
            <button className={`btn-primary btn-pink ${(!name.trim()||loading)?'btn-disabled':''}`} style={{flex:1}} onClick={handleCreate}>{loading?'...':'Crear'}</button>
          </div>
        </div>
      )}
    </div>
  )
}

function PatternSection({ child }: { child: Child }) {
  const { user } = useAuth()
  const { pattern } = useAppStore()
  const [patternType, setPatternType] = useState(pattern?.type ?? 'alternating_weekly')
  const [startDate, setStartDate] = useState(pattern?.startDate ?? '')
  const [startParentId, setStartParentId] = useState(pattern?.startParentId ?? child.parents[0])
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    if (!user || !startDate) return; setLoading(true)
    try { await setPattern({ childId: child.id, type: patternType as any, startDate, startParentId, createdBy: user.uid }); setSaved(true); setTimeout(() => setSaved(false), 2000) } finally { setLoading(false) }
  }

  return (
    <div className="card">
      <div style={{fontSize:13,fontWeight:700,color:'#9ca3af',marginBottom:12}}>📅 Patrón de custodia</div>
      <div style={{marginBottom:10}}><div className="settings-label">Tipo de régimen</div>
        <select value={patternType} onChange={e => setPatternType(e.target.value as any)} className="settings-select">
          {Object.entries(PATTERN_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div style={{marginBottom:10}}><div className="settings-label">Fecha de inicio del patrón</div><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="settings-input" /></div>
      {child.parents.length >= 2 && (
        <div style={{marginBottom:12}}>
          <div className="settings-label">¿Quién empieza?</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            {child.parents.map(pid => (
              <div key={pid} className={`parent-chip ${startParentId===pid?'selected':''}`} onClick={() => setStartParentId(pid)}>
                <div className="parent-chip-dot" style={{background: child.parentColors?.[pid] ?? '#6B7280'}} />
                <div className="parent-chip-name">{child.parentNames?.[pid]?.split(' ')[0] ?? 'Progenitor'}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <button className={`btn-primary ${saved?'btn-success':'btn-violet'} ${(!startDate||loading)?'btn-disabled':''}`} onClick={handleSave}>
        {loading?'Guardando...':saved?'✓ Guardado':'Guardar patrón'}
      </button>
    </div>
  )
}

function InviteSection({ child }: { child: Child }) {
  const { user } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleInvite = async () => {
    if (!user || !email.trim()) return; setLoading(true)
    try { await createInvitation({ childId: child.id, childName: child.name, fromEmail: user.email ?? '', fromName: user.displayName ?? user.email ?? 'Progenitor', toEmail: email.trim().toLowerCase() }); setSent(true); setEmail('') } finally { setLoading(false) }
  }

  return (
    <div className="card">
      <div style={{fontSize:13,fontWeight:700,color:'#9ca3af',marginBottom:12}}>👤 Invitar al otro progenitor</div>
      {sent ? (
        <div className="invite-success">
          <div className="invite-success-icon">📨</div>
          <div className="invite-success-title">Invitación enviada</div>
          <div className="invite-success-sub">Cuando acepte, verá el mismo calendario</div>
          <button onClick={() => setSent(false)} style={{marginTop:12,fontSize:12,color:'#6b7280',background:'none',border:'none',cursor:'pointer'}}>Invitar a otro</button>
        </div>
      ) : (
        <>
          <div style={{fontSize:12,color:'#6b7280',marginBottom:10}}>Introduce el email de Google del otro progenitor. Recibirá acceso al calendario de <strong style={{color:'#9ca3af'}}>{child.name}</strong>.</div>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@ejemplo.com" className="settings-input" style={{marginBottom:10}} />
          <button className={`btn-primary btn-green ${(!email.includes('@')||loading)?'btn-disabled':''}`} onClick={handleInvite}>{loading?'Enviando...':'Enviar invitación'}</button>
        </>
      )}
    </div>
  )
}

function ParentsInfo({ child }: { child: Child }) {
  const { user } = useAuth()
  return (
    <div className="card">
      <div style={{fontSize:13,fontWeight:700,color:'#9ca3af',marginBottom:12}}>👥 Progenitores</div>
      {child.parents.map(pid => (
        <div key={pid} className="parent-item">
          <div className="parent-avatar" style={{background: child.parentColors?.[pid] ?? '#6B7280'}}>{(child.parentNames?.[pid] ?? '?')[0]?.toUpperCase()}</div>
          <div>
            <div className="parent-name">{child.parentNames?.[pid] ?? 'Progenitor'}{pid===user?.uid && <span style={{marginLeft:6,fontSize:11,color:'#6b7280'}}>(tú)</span>}</div>
            <div className="parent-email">{child.parentEmails?.[child.parents.indexOf(pid)]}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
