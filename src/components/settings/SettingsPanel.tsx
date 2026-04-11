'use client'
import { useEffect, useState, useMemo } from 'react'
import { useAppStore } from '@/store/app'
import { useAuth } from '@/lib/auth-context'
import { useTheme, type ThemeMode } from '@/lib/theme-context'
import { createChild, createInvitation, acceptInvitation, setPattern, forgetChild, resendInvitation, cancelInvitation, subscribeToUserNotificationSettings, updateUserNotificationSettings } from '@/lib/db'
import { PARENT_COLORS, PATTERN_LABELS } from '@/lib/utils'
import { SpecialPeriodsManager } from '@/components/settings/SpecialPeriodsManager'
import { PushSection } from '@/components/settings/PushSection'
import type { Child, Invitation, NotificationChannel, UserNotificationSettings } from '@/types'

export function SettingsPanel() {
  const { invitations, children, selectedChildId } = useAppStore()
  const { user } = useAuth()
  const child = useMemo(() => children.find(c => c.id === selectedChildId) ?? null, [children, selectedChildId])
  const receivedInvitations = useMemo(() => invitations.filter(i => i.toEmail === (user?.email ?? '').toLowerCase() && i.status === 'pending'), [invitations, user?.email])
  const sentInvitations = useMemo(() => child ? invitations.filter(i => i.childId === child.id && i.fromEmail === (user?.email ?? '').toLowerCase()) : [], [invitations, child, user?.email])

  return (
    <div>
      <ThemeSection />
      <PushSection />
      <NotificationPreferencesSection />
      {receivedInvitations.length > 0 && <PendingInvitations invitations={receivedInvitations} />}
      <ChildSection child={child} />
      {child && <PatternSection child={child} />}
      {child && <SpecialPeriodsManager />}
      {child && child.parents.length < 2 && <InviteSection child={child} sentInvitations={sentInvitations} />}
      {child && child.parents.length >= 2 && <ParentsInfo child={child} />}
      {child && <DangerZone child={child} />}
    </div>
  )
}

function ThemeSection() {
  const { mode, resolvedTheme, setMode } = useTheme()
  const options: { value: ThemeMode; label: string }[] = [
    { value: 'light', label: 'Claro' },
    { value: 'dark', label: 'Oscuro' },
    { value: 'system', label: 'Auto' },
  ]

  return (
    <div className="card">
      <div style={{ fontSize: 13, fontWeight: 700, color: '#9ca3af', marginBottom: 12 }}>🎨 Apariencia</div>
      <div className="theme-segment">
        {options.map(option => (
          <button key={option.value} className={mode === option.value ? 'active' : ''} onClick={() => setMode(option.value)}>
            {option.label}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 8 }}>
        Modo actual: <strong style={{ color: 'var(--text-secondary)' }}>{resolvedTheme === 'dark' ? 'Oscuro' : 'Claro'}</strong>
      </div>
    </div>
  )
}

function NotificationPreferencesSection() {
  const { user } = useAuth()
  const [settings, setSettings] = useState<UserNotificationSettings | null>(null)
  const [savingKey, setSavingKey] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.uid) return
    return subscribeToUserNotificationSettings(user.uid, setSettings)
  }, [user?.uid])

  const options: { value: NotificationChannel; label: string }[] = [
    { value: 'off', label: 'Desactivado' },
    { value: 'in_app', label: 'Solo campanita' },
    { value: 'push', label: 'Solo push' },
    { value: 'both', label: 'Ambos' },
  ]

  const updatePref = async (key: 'changes' | 'assignments' | 'reminders' | 'notes', value: NotificationChannel) => {
    if (!user?.uid) return
    setSavingKey(key)
    try { await updateUserNotificationSettings(user.uid, { [key]: value }) }
    finally { setSavingKey(null) }
  }

  if (!settings) return null

  const rows: { key: 'changes' | 'assignments' | 'reminders' | 'notes'; title: string; sub: string }[] = [
    { key: 'changes', title: 'Cambios de custodia', sub: 'Solicitudes nuevas, aceptadas, rechazadas o canceladas' },
    { key: 'assignments', title: 'Asignaciones de eventos', sub: 'Peticiones y respuestas sobre eventos asignados' },
    { key: 'reminders', title: 'Recordatorios', sub: 'Avisos previos de eventos programados' },
    { key: 'notes', title: 'Notas importantes', sub: 'Preparado para notas con mención o avisos relevantes' },
  ]

  return (
    <div className="card">
      <div style={{ fontSize: 13, fontWeight: 700, color: '#9ca3af', marginBottom: 12 }}>🔔 Preferencias de avisos</div>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {rows.map(row => (
          <div key={row.key} style={{ padding:'10px 0', borderTop: row.key === 'changes' ? 'none' : '1px solid var(--border)' }}>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--text-strong)', marginBottom:4 }}>{row.title}</div>
            <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:8 }}>{row.sub}</div>
            <select value={settings[row.key]} onChange={e => updatePref(row.key, e.target.value as NotificationChannel)} className="settings-select" disabled={savingKey === row.key}>
              {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
        ))}
      </div>
    </div>
  )
}

function PendingInvitations({ invitations }: { invitations: Invitation[] }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const handleAccept = async (inv: Invitation) => {
    if (!user) return
    setLoading(inv.id); setError('')
    try { await acceptInvitation(inv, user.uid, user.displayName ?? user.email ?? 'Progenitor') }
    catch (e: any) { setError(e?.message || 'No se pudo aceptar la invitación') }
    finally { setLoading(null) }
  }
  return (
    <div className="invite-pending">
      <div className="invite-pending-title">📨 Invitaciones recibidas</div>
      {invitations.map(inv => (
        <div key={inv.id} className="invite-pending-row">
          <div><div className="invite-pending-text">{inv.fromName} te invita a gestionar a <strong>{inv.childName}</strong></div><div className="invite-pending-sub">{inv.fromEmail}</div></div>
          <button className="btn-accept-invite" disabled={loading === inv.id} onClick={() => handleAccept(inv)}>{loading === inv.id ? '...' : 'Aceptar'}</button>
        </div>
      ))}
      {error && <div style={{ marginTop: 10, color: '#fca5a5', fontSize: 12 }}>{error}</div>}
    </div>
  )
}

function ChildSection({ child }: { child: Child | null }) {
  const { user } = useAuth()
  const { children, selectedChildId, setSelectedChildId } = useAppStore()
  const [show, setShow] = useState(false)
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [color, setColor] = useState(PARENT_COLORS[0])
  const [loading, setLoading] = useState(false)
  const handleCreate = async () => {
    if (!user || !name.trim()) return
    setLoading(true)
    try {
      const id = await createChild({ name: name.trim(), birthDate, createdBy: user.uid, parents: [user.uid], parentEmails: [user.email?.toLowerCase() ?? ''], parentNames: { [user.uid]: user.displayName ?? user.email ?? 'Yo' }, parentColors: { [user.uid]: color } })
      setSelectedChildId(id); setShow(false); setName('')
    } finally { setLoading(false) }
  }
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}><div style={{ fontSize: 13, fontWeight: 700, color: '#9ca3af' }}>👶 Menor</div>{!show && <button onClick={() => setShow(true)} style={{ fontSize: 12, color: '#3B82F6', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>+ Añadir menor</button>}</div>
      {children.map(c => <button key={c.id} className={`child-item ${selectedChildId === c.id ? 'selected' : ''}`} onClick={() => setSelectedChildId(c.id)}><div className="child-item-avatar">{c.name[0]}</div><div><div className="child-item-name">{c.name}</div><div className="child-item-sub">{c.parents.length} progenitor(es)</div></div></button>)}
      {show && <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}><div style={{ marginBottom: 10 }}><div className="settings-label">Nombre del menor</div><input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre" className="settings-input" /></div><div style={{ marginBottom: 10 }}><div className="settings-label">Fecha de nacimiento (opcional)</div><input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} className="settings-input" /></div><div style={{ marginBottom: 12 }}><div className="settings-label">Tu color en el calendario</div><div className="color-swatches">{PARENT_COLORS.map(c => <div key={c} className={`color-swatch ${color === c ? 'selected' : ''}`} style={{ background: c }} onClick={() => setColor(c)} />)}</div></div><div style={{ display: 'flex', gap: 8 }}><button className="btn-primary btn-outline" style={{ flex: 1 }} onClick={() => setShow(false)}>Cancelar</button><button style={{ flex:1, padding:'10px', borderRadius:12, border:'none', background:(!name.trim()||loading)?'rgba(255,255,255,0.08)':'#EC4899', color:(!name.trim()||loading)?'#6b7280':'#fff', fontSize:13, fontWeight:700, cursor:(!name.trim()||loading)?'not-allowed':'pointer' }} onClick={handleCreate} disabled={!name.trim()||loading}>{loading ? '...' : 'Crear'}</button></div></div>}
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
  const handleSave = async () => { if (!user || !startDate) return; setLoading(true); try { await setPattern({ childId: child.id, type: patternType as any, startDate, startParentId, createdBy: user.uid }); setSaved(true); setTimeout(() => setSaved(false), 2000) } finally { setLoading(false) } }
  return <div className="card"><div style={{ fontSize: 13, fontWeight: 700, color: '#9ca3af', marginBottom: 12 }}>📅 Patrón de custodia</div><div style={{ marginBottom: 10 }}><div className="settings-label">Tipo de régimen</div><select value={patternType} onChange={e => setPatternType(e.target.value as any)} className="settings-select">{Object.entries(PATTERN_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div><div style={{ marginBottom: 10 }}><div className="settings-label">Fecha de inicio del patrón</div><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="settings-input" /></div>{child.parents.length >= 2 && <div style={{ marginBottom: 12 }}><div className="settings-label">¿Quién empieza?</div><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>{child.parents.map(pid => <div key={pid} className={`parent-chip ${startParentId === pid ? 'selected' : ''}`} onClick={() => setStartParentId(pid)}><div className="parent-chip-dot" style={{ background: child.parentColors?.[pid] ?? '#6B7280' }} /><div className="parent-chip-name">{child.parentNames?.[pid]?.split(' ')[0] ?? 'Progenitor'}</div></div>)}</div></div>}<button style={{ width:'100%', padding:'11px', borderRadius:12, border:'none', background:(!startDate||loading)?'rgba(255,255,255,0.08)':saved?'#10b981':'#8B5CF6', color:(!startDate||loading)?'#6b7280':'#fff', fontSize:13, fontWeight:700, cursor:(!startDate||loading)?'not-allowed':'pointer' }} onClick={handleSave} disabled={!startDate||loading}>{loading ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar patrón'}</button></div>
}

function InviteSection({ child, sentInvitations }: { child: Child; sentInvitations: Invitation[] }) {
  const { user } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const handleInvite = async () => {
    if (!user || !email.trim()) return
    setLoading(true); setError('')
    try {
      await createInvitation({ childId: child.id, childName: child.name, fromEmail: user.email?.toLowerCase() ?? '', fromName: user.displayName ?? user.email ?? 'Progenitor', toEmail: email.trim().toLowerCase() })
      setEmail('')
    } catch (e: any) { setError(e?.message || 'No se pudo enviar la invitación') }
    finally { setLoading(false) }
  }
  return (
    <div className="card">
      <div style={{ fontSize: 13, fontWeight: 700, color: '#9ca3af', marginBottom: 12 }}>👤 Invitar al otro progenitor</div>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>Introduce el email de Google del otro progenitor.</div>
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@ejemplo.com" className="settings-input" style={{ marginBottom: 10 }} />
      <button style={{ width:'100%', padding:'11px', borderRadius:12, border:'none', background:(!email.includes('@')||loading)?'rgba(255,255,255,0.08)':'#10b981', color:(!email.includes('@')||loading)?'#6b7280':'#fff', fontSize:13, fontWeight:700, cursor:(!email.includes('@')||loading)?'not-allowed':'pointer' }} onClick={handleInvite} disabled={!email.includes('@')||loading}>{loading ? 'Enviando...' : 'Enviar invitación'}</button>
      {error && <div style={{ marginTop:10, color:'#fca5a5', fontSize:12 }}>{error}</div>}
      {sentInvitations.length > 0 && <div style={{ marginTop:14 }}><div style={{ fontSize:12, fontWeight:700, color:'#9ca3af', marginBottom:8 }}>Invitaciones enviadas</div><div style={{ display:'flex', flexDirection:'column', gap:8 }}>{sentInvitations.map(inv => <div key={inv.id} style={{ padding:'10px 12px', borderRadius:12, background:'var(--bg-soft)', border:'1px solid var(--border)' }}><div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}><div><div style={{ color:'var(--text-strong)', fontSize:12 }}>{inv.toEmail}</div><div style={{ color: inv.status === 'pending' ? '#fbbf24' : inv.status === 'accepted' ? '#10b981' : inv.status === 'cancelled' ? '#9ca3af' : '#f87171', fontSize:11, fontWeight:700 }}>{inv.status.toUpperCase()}</div></div><div style={{ display:'flex', gap:8 }}>{inv.status !== 'accepted' && <button onClick={() => resendInvitation(inv.id)} style={{ background:'none', border:'none', color:'#60a5fa', fontSize:12, fontWeight:700, cursor:'pointer' }}>Reenviar</button>}{inv.status === 'pending' && <button onClick={() => cancelInvitation(inv.id)} style={{ background:'none', border:'none', color:'#f87171', fontSize:12, fontWeight:700, cursor:'pointer' }}>Cancelar</button>}</div></div></div>)}</div></div>}
    </div>
  )
}

function ParentsInfo({ child }: { child: Child }) {
  const { user } = useAuth()
  return <div className="card"><div style={{ fontSize: 13, fontWeight: 700, color: '#9ca3af', marginBottom: 12 }}>👥 Progenitores</div>{child.parents.map(pid => <div key={pid} className="parent-item"><div className="parent-avatar" style={{ background: child.parentColors?.[pid] ?? '#6B7280' }}>{(child.parentNames?.[pid] ?? '?')[0]?.toUpperCase()}</div><div><div className="parent-name">{child.parentNames?.[pid] ?? 'Progenitor'}{pid === user?.uid && <span style={{ marginLeft: 6, fontSize: 11, color: '#6b7280' }}>(tú)</span>}</div><div className="parent-email">{child.parentEmails?.[child.parents.indexOf(pid)]}</div></div></div>)}</div>
}

function DangerZone({ child }: { child: Child }) {
  const { user } = useAuth()
  const { setSelectedChildId } = useAppStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const canForget = !!user && child.parents.includes(user.uid) && child.parents.length > 1
  const handleForget = async () => {
    if (!user || !canForget) return
    if (!window.confirm(`¿Seguro que quieres olvidar a ${child.name}? Dejarás de verlo en tu cuenta.`)) return
    setLoading(true); setError('')
    try { await forgetChild(child.id, user.uid); setSelectedChildId(null) } catch (e: any) { setError(e?.message || 'No se pudo olvidar este menor') } finally { setLoading(false) }
  }
  if (!canForget) return null
  return <div className="card" style={{ borderColor: 'rgba(239,68,68,0.25)' }}><div style={{ fontSize: 13, fontWeight: 700, color: '#fca5a5', marginBottom: 10 }}>⚠️ Zona sensible</div><div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 12 }}>Puedes quitar este menor de tu cuenta sin borrar sus datos del otro progenitor.</div><button onClick={handleForget} disabled={loading} style={{ width:'100%', padding:'11px', borderRadius:12, border:'none', background:loading?'rgba(255,255,255,0.08)':'#ef4444', color:loading?'#6b7280':'#fff', fontSize:13, fontWeight:700, cursor:loading?'not-allowed':'pointer' }}>{loading ? 'Quitando...' : 'Olvidar este menor'}</button>{error && <div style={{ marginTop: 10, color: '#fca5a5', fontSize: 12 }}>{error}</div>}</div>
}
