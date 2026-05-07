'use client'

import { useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { createEvent } from '@/lib/db'
import { showToast } from '@/lib/toast'
import { CAT_CONFIG } from '@/components/events/location/shared'
import type { EventCategory } from '@/types'

const steps = ['Qué crear', 'Para quién', 'Tipo', 'Nombre', 'Cuándo', 'Dónde', 'Opciones', 'Resumen']
const today = () => new Date().toISOString().slice(0, 10)

export function GuidedCreationPanel() {
  const { user } = useAuth()
  const { children, selectedChildId, setSelectedChildId } = useAppStore()
  const [step, setStep] = useState(0)
  const [childId, setChildId] = useState(selectedChildId || children[0]?.id || '')
  const [category, setCategory] = useState<EventCategory>('medico')
  const [title, setTitle] = useState('Cita médica')
  const [date, setDate] = useState(today())
  const [endDate, setEndDate] = useState('')
  const [allDay, setAllDay] = useState(false)
  const [time, setTime] = useState('10:30')
  const [endTime, setEndTime] = useState('')
  const [locationName, setLocationName] = useState('')
  const [locationAddress, setLocationAddress] = useState('')
  const [reminderEnabled, setReminderEnabled] = useState(false)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const child = useMemo(() => children.find(item => item.id === childId) || null, [children, childId])
  const current = steps[step]
  const canNext = step === 1 ? !!child : step === 3 ? !!title.trim() : step === 4 ? !!date && (!endDate || endDate >= date) && (allDay || !endTime || !time || time < endTime) : true

  const next = () => {
    if (!canNext) { setError('Completa esta pantalla para continuar.'); return }
    setError('')
    setStep(value => Math.min(steps.length - 1, value + 1))
  }

  const save = async () => {
    if (!user || !child || saving) return
    setSaving(true)
    setError('')
    try {
      const eventId = await createEvent({
        childId: child.id,
        createdBy: user.uid,
        title: title.trim(),
        category,
        date,
        endDate: endDate || undefined,
        allDay,
        time: allDay ? undefined : time || undefined,
        endTime: allDay ? undefined : endTime || undefined,
        notes: notes.trim() || undefined,
        documentIds: [],
        recurrence: 'none',
        reminderEnabled,
        reminderDaysBefore: reminderEnabled ? 1 : undefined,
        reminderAudience: reminderEnabled ? 'self' : undefined,
        locationName: locationName.trim() || undefined,
        locationAddress: locationAddress.trim() || undefined,
      } as any)
      setSelectedChildId(child.id)
      showToast({ message: 'Evento creado desde la creación guiada.', tone: 'success' })
      window.dispatchEvent(new CustomEvent('custodia:navigate', { detail: { tab: 'events', childId: child.id, date, focusTargetId: `event-${eventId}` } }))
    } catch (err: any) {
      const message = err?.message || 'No se pudo guardar el evento.'
      setError(message)
      showToast({ message, tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const hero = (
    <div className="card" style={{ padding: 18, borderRadius: 26, background: 'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-soft) 100%)', border: '1px solid rgba(124,58,237,0.24)' }}>
      <div style={{ color: '#7c3aed', fontSize: 10, fontWeight: 950, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 5 }}>Creación guiada</div>
      <h1 style={{ margin: 0, color: 'var(--text-strong)', fontSize: 24, lineHeight: 1.05 }}>Una pregunta cada vez</h1>
      <p style={{ margin: '8px 0 0', color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.45 }}>Crea un evento paso a paso, rápido y sin ver todos los campos de golpe.</p>
    </div>
  )

  const body = () => {
    if (step === 0) return <div style={{ display: 'grid', gap: 10 }}>{[
      ['📅','Evento','Citas, colegio, actividades y vacaciones.'], ['🔄','Cambio','Próximamente.'], ['🔒','Bloqueo','Próximamente.'], ['💗','Tratamiento','Próximamente.'], ['💬','Nota','Próximamente.']
    ].map(([icon, name, sub], index) => <button key={name} type="button" onClick={() => index === 0 ? setStep(1) : showToast({ message: 'Ese flujo lo añadiremos después.', tone: 'info' })} style={{ display:'flex', alignItems:'center', gap:12, padding:12, borderRadius:18, border:`1px solid ${index === 0 ? '#7c3aed' : 'var(--border)'}`, background:index === 0 ? 'rgba(124,58,237,.10)' : 'var(--bg-card)', color:'var(--text-strong)', cursor:'pointer', textAlign:'left' }}><span style={{ fontSize:22 }}>{icon}</span><span style={{ flex:1 }}><strong>{name}</strong><br/><small style={{ color:'var(--text-secondary)' }}>{sub}</small></span><span>{index === 0 ? '›' : 'Pronto'}</span></button>)}</div>
    if (step === 1) return <div style={{ display:'grid', gap:10 }}>{children.map(item => <button key={item.id} type="button" onClick={() => setChildId(item.id)} style={{ padding:14, borderRadius:18, border:`1px solid ${item.id === childId ? '#7c3aed' : 'var(--border)'}`, background:item.id === childId ? 'rgba(124,58,237,.12)' : 'var(--bg-card)', color:'var(--text-strong)', cursor:'pointer', textAlign:'left' }}>👶 <strong>{item.name}</strong><div style={{ color:'var(--text-secondary)', fontSize:12, marginTop:4 }}>Calendario familiar</div></button>)}</div>
    if (step === 2) return <div style={{ display:'grid', gridTemplateColumns:'repeat(2,minmax(0,1fr))', gap:8 }}>{Object.entries(CAT_CONFIG).map(([key, value]) => <button key={key} type="button" onClick={() => { setCategory(key as EventCategory); setTitle(value.label === 'Médico' ? 'Cita médica' : value.label) }} style={{ minHeight:86, borderRadius:18, border:`1px solid ${category === key ? value.color : 'var(--border)'}`, background:category === key ? `${value.color}20` : 'var(--bg-card)', color:category === key ? value.color : 'var(--text-secondary)', cursor:'pointer' }}><div style={{ fontSize:24 }}>{value.icon}</div><strong>{value.label}</strong></button>)}</div>
    if (step === 3) return <div><input value={title} onChange={event => setTitle(event.target.value)} className="settings-input" placeholder="Ej: Revisión pediatra" /><div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:10 }}>{['Cita médica','Reunión colegio','Extraescolar','Cumpleaños'].map(item => <button key={item} type="button" onClick={() => setTitle(item)} style={{ border:'1px solid var(--border)', borderRadius:999, background:'var(--bg-soft)', color:'var(--text-secondary)', padding:'7px 10px', fontWeight:800 }}>{item}</button>)}</div></div>
    if (step === 4) return <div style={{ display:'grid', gap:10 }}><label><div className="settings-label">Fecha desde</div><input type="date" value={date} onChange={event => setDate(event.target.value)} className="settings-input" /></label><label><div className="settings-label">Fecha hasta (opcional)</div><input type="date" value={endDate} min={date} onChange={event => setEndDate(event.target.value)} className="settings-input" /></label><div className="type-toggle"><button type="button" className={`type-btn ${allDay ? 'active' : ''}`} onClick={() => setAllDay(true)}>☀️ Todo el día</button><button type="button" className={`type-btn ${!allDay ? 'active' : ''}`} onClick={() => setAllDay(false)}>🕒 Con hora</button></div>{!allDay && <div className="date-pair"><label><div className="date-pair-label">Hora desde</div><input type="time" value={time} onChange={event => setTime(event.target.value)} className="settings-input" /></label><label><div className="date-pair-label">Hora hasta</div><input type="time" value={endTime} min={time} onChange={event => setEndTime(event.target.value)} className="settings-input" /></label></div>}</div>
    if (step === 5) return <div style={{ display:'grid', gap:10 }}><label><div className="settings-label">Lugar</div><input value={locationName} onChange={event => setLocationName(event.target.value)} className="settings-input" placeholder="Ej: Clínica Sanitas" /></label><label><div className="settings-label">Dirección (opcional)</div><input value={locationAddress} onChange={event => setLocationAddress(event.target.value)} className="settings-input" placeholder="Calle, número, ciudad" /></label></div>
    if (step === 6) return <div style={{ display:'grid', gap:12 }}><label style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:14, border:'1px solid var(--border)', borderRadius:18, background:'var(--bg-card)' }}><span><strong>🔔 Recordatorio</strong><br/><small style={{ color:'var(--text-secondary)' }}>1 día antes</small></span><input type="checkbox" checked={reminderEnabled} onChange={event => setReminderEnabled(event.target.checked)} /></label><label><div className="settings-label">Notas opcionales</div><textarea value={notes} onChange={event => setNotes(event.target.value)} className="settings-textarea" rows={3} placeholder="Añade detalles importantes..." /></label></div>
    return <div style={{ padding:14, border:'1px solid var(--border)', borderRadius:20, background:'var(--bg-card)' }}>{[['Tipo', CAT_CONFIG[category]?.label || 'Evento'], ['Para', child?.name || '—'], ['Título', title], ['Fecha', endDate ? `${date} → ${endDate}` : date], ['Hora', allDay ? 'Todo el día' : `${time}${endTime ? `-${endTime}` : ''}`], ['Lugar', locationName || locationAddress || 'Sin lugar'], ['Recordatorio', reminderEnabled ? 'Activado' : 'No']].map(([label, value]) => <div key={label} style={{ display:'flex', justifyContent:'space-between', gap:10, padding:'9px 0', borderBottom:'1px solid var(--border)', color:'var(--text-secondary)', fontSize:12 }}><strong>{label}</strong><span style={{ color:'var(--text-strong)', fontWeight:900, textAlign:'right' }}>{value}</span></div>)}</div>
  }

  return <section style={{ display:'grid', gap:14, width:'100%', maxWidth:620, margin:'0 auto', paddingBottom:18 }}>{hero}<div className="card" style={{ padding:16, borderRadius:26, background:'var(--bg-card)', border:'1px solid var(--border)' }}><div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}><span style={{ background:'rgba(124,58,237,.12)', color:'#8b5cf6', borderRadius:999, padding:'6px 9px', fontSize:11, fontWeight:950 }}>Paso {step + 1} de {steps.length}</span><span style={{ color:'var(--text-muted)', fontSize:11, fontWeight:850 }}>{current}</span></div><div style={{ display:'flex', gap:5, marginBottom:18 }}>{steps.map((item, index) => <span key={item} style={progressStyle(index, step)} />)}</div><div style={{ marginBottom:16 }}><div style={{ color:'#7c3aed', fontSize:11, fontWeight:950, textTransform:'uppercase', marginBottom:6 }}>{current}</div><h2 style={{ margin:0, color:'var(--text-strong)', fontSize:21 }}>{step === 0 ? '¿Qué quieres crear?' : step === 1 ? '¿Para quién es?' : step === 2 ? '¿Qué tipo de evento es?' : step === 3 ? '¿Cómo lo llamamos?' : step === 4 ? '¿Cuándo será?' : step === 5 ? '¿Dónde será?' : step === 6 ? '¿Quieres añadir algo más?' : '¿Está todo correcto?'}</h2></div>{body()}{error && <div style={{ marginTop:12, padding:9, borderRadius:12, background:'rgba(239,68,68,.12)', color:'#fca5a5', fontSize:12, fontWeight:800 }}>{error}</div>}<div style={{ display:'flex', gap:8, marginTop:16 }}><button type="button" className="btn-primary btn-outline" style={{ flex:1 }} onClick={() => setStep(value => Math.max(0, value - 1))} disabled={step === 0 || saving}>Anterior</button>{step < steps.length - 1 ? <button type="button" style={{ flex:1, padding:11, borderRadius:13, border:'none', background:canNext ? 'linear-gradient(135deg,#7c3aed,#4f46e5)' : 'rgba(255,255,255,.08)', color:canNext ? '#fff' : '#6b7280', fontWeight:900 }} onClick={next} disabled={!canNext || saving}>Siguiente</button> : <button type="button" style={{ flex:1, padding:11, borderRadius:13, border:'none', background:'linear-gradient(135deg,#7c3aed,#4f46e5)', color:'#fff', fontWeight:900 }} onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Guardar evento'}</button>}</div></div></section>
}
