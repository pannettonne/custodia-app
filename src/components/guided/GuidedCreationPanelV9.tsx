'use client'

import { useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { createEvent } from '@/lib/db'
import { showToast } from '@/lib/toast'
import { CAT_CONFIG, notifyEventAssignmentPending } from '@/components/events/location/shared'
import { AssignmentSelector } from '@/components/events/location/AssignmentSelector'
import { GuidedLocationStep2 } from './GuidedLocationStep2'
import { GuidedOptionsStep } from './GuidedOptionsStep'
import { GuidedChangePanel } from './GuidedChangePanel'
import { GuidedBlockPanel } from './GuidedBlockPanel'
import { GuidedTreatmentPanel } from './GuidedTreatmentPanel'
import { GuidedNotePanel } from './GuidedNotePanel'
import type { EventCategory, EventReminderAudience } from '@/types'

const STEPS = ['Qué crear', 'Tipo', 'Nombre', 'Cuándo', 'Dónde', 'Custodia', 'Opciones', 'Resumen']
const QUESTIONS = ['¿Qué quieres crear?', '¿Qué tipo de evento es?', '¿Cómo lo llamamos?', '¿Cuándo será?', '¿Dónde será?', '¿Quieres asignarlo a alguien?', '¿Quieres añadir algo más?', '¿Está todo correcto?']
const today = () => new Date().toISOString().slice(0, 10)
const bar = (i: number, s: number) => ({ flex: 1, height: 5, borderRadius: 999, background: i <= s ? 'linear-gradient(90deg,#7c3aed,#4f46e5)' : 'rgba(148,163,184,.24)' })

export function GuidedCreationPanel() {
  const { user } = useAuth()
  const { children, selectedChildId, setSelectedChildId } = useAppStore()
  const child = useMemo(() => children.find(c => c.id === selectedChildId) || null, [children, selectedChildId])
  const [mode, setMode] = useState<'menu' | 'event' | 'change' | 'block' | 'treatment' | 'note'>('menu')
  const [step, setStep] = useState(0)
  const [category, setCategory] = useState<EventCategory>('medico')
  const [title, setTitle] = useState('Cita médica')
  const [date, setDate] = useState(today())
  const [endDate, setEndDate] = useState('')
  const [allDay, setAllDay] = useState(true)
  const [time, setTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [locationName, setLocationName] = useState('')
  const [locationAddress, setLocationAddress] = useState('')
  const [locationLatitude, setLocationLatitude] = useState<number | undefined>()
  const [locationLongitude, setLocationLongitude] = useState<number | undefined>()
  const [locationPlaceId, setLocationPlaceId] = useState('')
  const [assignedParentId, setAssignedParentId] = useState('')
  const [reminderEnabled, setReminderEnabled] = useState(false)
  const [reminderDaysBefore, setReminderDaysBefore] = useState(1)
  const [reminderAudience, setReminderAudience] = useState<EventReminderAudience>('self')
  const [notesEnabled, setNotesEnabled] = useState(false)
  const [notes, setNotes] = useState('')
  const [documentsEnabled, setDocumentsEnabled] = useState(false)
  const [documentIds, setDocumentIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  if (mode === 'change') return <GuidedChangePanel onBack={() => setMode('menu')} />
  if (mode === 'block') return <GuidedBlockPanel onBack={() => setMode('menu')} />
  if (mode === 'treatment') return <GuidedTreatmentPanel onBack={() => setMode('menu')} />
  if (mode === 'note') return <GuidedNotePanel onBack={() => setMode('menu')} />

  const validDate = !!date && (!endDate || endDate >= date)
  const validTime = allDay || !endTime || !time || time < endTime
  const canNext = step === 0 ? !!child : step === 2 ? !!title.trim() : step === 3 ? validDate && validTime : true
  const next = () => { if (!canNext) { setError(step === 0 ? 'Selecciona primero un menor en la app.' : 'Completa esta pantalla para continuar.'); return }; setError(''); setStep(v => Math.min(STEPS.length - 1, v + 1)) }

  async function save() {
    if (!user || !child || saving || !title.trim() || !validDate || !validTime) return
    setSaving(true); setError('')
    try {
      const otherParentId = child.parents.find(pid => pid !== user.uid)
      const wantsAssignment = !!assignedParentId && !!otherParentId
      const eventId = await createEvent({ childId: child.id, createdBy: user.uid, title: title.trim(), category, date, endDate: endDate || undefined, allDay, time: allDay ? undefined : time || undefined, endTime: allDay ? undefined : endTime || undefined, notes: notesEnabled ? notes.trim() || undefined : undefined, documentIds: documentsEnabled ? documentIds : [], recurrence: 'none', assignedParentId: wantsAssignment ? assignedParentId : undefined, assignmentStatus: wantsAssignment ? 'pending' : undefined, assignmentRequestedBy: wantsAssignment ? user.uid : undefined, assignmentRequestedByName: wantsAssignment ? (user.displayName || user.email || 'Progenitor') : undefined, assignmentRequestToParentId: wantsAssignment ? otherParentId : undefined, reminderEnabled, reminderDaysBefore: reminderEnabled ? reminderDaysBefore : undefined, reminderAudience: reminderEnabled ? reminderAudience : undefined, locationName: locationName.trim() || undefined, locationAddress: locationAddress.trim() || undefined, locationLatitude, locationLongitude, locationPlaceId: locationPlaceId || undefined } as any)
      if (wantsAssignment && otherParentId) await notifyEventAssignmentPending({ toUserId: otherParentId, childId: child.id, childName: child.name, eventTitle: title.trim(), dateKey: date, requesterName: user.displayName || user.email || 'Progenitor' })
      setSelectedChildId(child.id)
      showToast({ message: 'Evento creado desde la creación guiada.', tone: 'success' })
      window.dispatchEvent(new CustomEvent('custodia:navigate', { detail: { tab: 'events', childId: child.id, date, focusTargetId: `event-${eventId}` } }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo guardar el evento.'
      setError(message); showToast({ message, tone: 'error' })
    } finally { setSaving(false) }
  }

  const selectMenu = (name: string) => {
    if (name === 'Evento') { setMode('event'); setStep(1); return }
    if (name === 'Cambio') { setMode('change'); return }
    if (name === 'Bloqueo') { setMode('block'); return }
    if (name === 'Tratamiento') { setMode('treatment'); return }
    if (name === 'Nota') { setMode('note'); return }
    showToast({ message: 'Ese flujo lo añadiremos después.', tone: 'info' })
  }

  const menuTone = (index: number) => index === 0 ? '#7c3aed' : index === 1 ? '#10b981' : index === 2 ? '#f59e0b' : index === 3 ? '#ef4444' : '#3b82f6'
  const menuBg = (index: number) => index === 0 ? 'rgba(124,58,237,.10)' : index === 1 ? 'rgba(16,185,129,.10)' : index === 2 ? 'rgba(245,158,11,.10)' : index === 3 ? 'rgba(239,68,68,.10)' : 'rgba(59,130,246,.10)'

  const body = () => {
    if (step === 0) return <div style={{ display: 'grid', gap: 10 }}>{['Evento', 'Cambio', 'Bloqueo', 'Tratamiento', 'Nota'].map((name, i) => <button key={name} type="button" onClick={() => selectMenu(name)} style={{ padding: 12, borderRadius: 18, border: `1px solid ${menuTone(i)}`, background: menuBg(i), color: 'var(--text-strong)', textAlign: 'left' }}><strong>{name}</strong><br /><small style={{ color: 'var(--text-secondary)' }}>{i === 0 ? 'Citas, colegio, actividades y vacaciones.' : i === 1 ? 'Solicitudes de cambio de custodia.' : i === 2 ? 'Bloqueos de disponibilidad.' : i === 3 ? 'Medicación y pautas de tratamiento.' : 'Notas, avisos y documentos compartidos.'}</small></button>)}</div>
    if (step === 1) return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>{Object.entries(CAT_CONFIG).map(([k, v]) => <button key={k} type="button" onClick={() => { setCategory(k as EventCategory); setTitle(v.label === 'Médico' ? 'Cita médica' : v.label) }} style={{ minHeight: 64, borderRadius: 16, border: `1px solid ${category === k ? v.color : 'var(--border)'}`, background: category === k ? `${v.color}1f` : 'var(--bg-card)', color: category === k ? v.color : 'var(--text-secondary)' }}><span style={{ fontSize: 16 }}>{v.icon}</span><br /><strong style={{ fontSize: 13 }}>{v.label}</strong></button>)}</div>
    if (step === 2) return <div><input className="settings-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej: Revisión pediatra" /><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>{['Cita médica', 'Reunión colegio', 'Extraescolar', 'Cumpleaños'].map(x => <button key={x} type="button" onClick={() => setTitle(x)} style={{ border: '1px solid var(--border)', borderRadius: 999, background: 'var(--bg-soft)', color: 'var(--text-secondary)', padding: '7px 10px', fontWeight: 800 }}>{x}</button>)}</div></div>
    if (step === 3) return <div style={{ display: 'grid', gap: 10 }}><label><div className="settings-label">Fecha desde</div><input type="date" className="settings-input" value={date} onChange={e => { const d = e.target.value; setDate(d); if (endDate && endDate < d) setEndDate('') }} /></label><label><div className="settings-label">Fecha hasta (opcional)</div><input type="date" className="settings-input" value={endDate} min={date || undefined} onChange={e => setEndDate(e.target.value)} /></label><div className="type-toggle"><button type="button" className={`type-btn ${allDay ? 'active' : ''}`} onClick={() => { setAllDay(true); setTime(''); setEndTime('') }}>Todo el día</button><button type="button" className={`type-btn ${!allDay ? 'active' : ''}`} onClick={() => { setAllDay(false); if (!time) setTime('10:30') }}>Con hora</button></div>{!allDay ? <div className="date-pair"><label><div className="date-pair-label">Hora desde</div><input type="time" className="settings-input" value={time} onChange={e => setTime(e.target.value)} /></label><label><div className="date-pair-label">Hora hasta</div><input type="time" className="settings-input" value={endTime} min={time || undefined} onChange={e => setEndTime(e.target.value)} /></label></div> : null}</div>
    if (step === 4) return <GuidedLocationStep2 locationName={locationName} setLocationName={setLocationName} locationAddress={locationAddress} setLocationAddress={setLocationAddress} setLocationLatitude={setLocationLatitude} setLocationLongitude={setLocationLongitude} setLocationPlaceId={setLocationPlaceId} />
    if (step === 5) return <div style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 18, background: 'var(--bg-card)' }}>{child && child.parents.length > 1 ? <AssignmentSelector child={child} assignedParentId={assignedParentId} setAssignedParentId={setAssignedParentId} /> : <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>No hay otro progenitor configurado para asignar este evento.</div>}</div>
    if (step === 6) return <GuidedOptionsStep childId={child?.id} reminderEnabled={reminderEnabled} setReminderEnabled={setReminderEnabled} reminderDaysBefore={reminderDaysBefore} setReminderDaysBefore={setReminderDaysBefore} reminderAudience={reminderAudience} setReminderAudience={setReminderAudience} notesEnabled={notesEnabled} setNotesEnabled={setNotesEnabled} notes={notes} setNotes={setNotes} documentsEnabled={documentsEnabled} setDocumentsEnabled={setDocumentsEnabled} documentIds={documentIds} setDocumentIds={setDocumentIds} />
    const rows = [['Menor', child?.name || '—'], ['Tipo', CAT_CONFIG[category]?.label || 'Evento'], ['Título', title], ['Fecha', endDate ? `${date} → ${endDate}` : date], ['Hora', allDay ? 'Todo el día' : `${time || 'Sin hora'}${endTime ? `-${endTime}` : ''}`], ['Lugar', locationName || locationAddress || 'Sin lugar'], ['Asignación', assignedParentId && child ? child.parentNames?.[assignedParentId] || 'Progenitor' : 'No'], ['Recordatorio', reminderEnabled ? `${reminderDaysBefore} día(s) antes` : 'No'], ['Notas', notesEnabled && notes.trim() ? 'Sí' : 'No'], ['Documentos', documentsEnabled && documentIds.length ? String(documentIds.length) : 'No']]
    return <div style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 20, background: 'var(--bg-card)' }}>{rows.map(([l, v]) => <div key={l} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 12 }}><strong>{l}</strong><span style={{ color: 'var(--text-strong)', fontWeight: 900, textAlign: 'right' }}>{v}</span></div>)}</div>
  }

  return <section style={{ display: 'grid', gap: 14, width: '100%', maxWidth: 620, margin: '0 auto', paddingBottom: 18 }}><div className="card" style={{ padding: 18, borderRadius: 26, background: 'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-soft) 100%)', border: '1px solid rgba(124,58,237,0.24)' }}><div style={{ color: '#7c3aed', fontSize: 10, fontWeight: 950, letterSpacing: .5, textTransform: 'uppercase', marginBottom: 5 }}>Creación guiada</div><h1 style={{ margin: 0, color: 'var(--text-strong)', fontSize: 24, lineHeight: 1.05 }}>Una pregunta cada vez</h1><p style={{ margin: '8px 0 0', color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.45 }}>{mode === 'menu' ? 'Elige qué quieres crear.' : `Crea un evento para ${child?.name || 'el menor seleccionado'} paso a paso.`}</p></div><div className="card" style={{ padding: 16, borderRadius: 26, background: 'var(--bg-card)', border: '1px solid var(--border)' }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}><span style={{ background: 'rgba(124,58,237,.12)', color: '#8b5cf6', borderRadius: 999, padding: '6px 9px', fontSize: 11, fontWeight: 950 }}>Paso {step + 1} de {STEPS.length}</span><span style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 850 }}>{STEPS[step]}</span></div><div style={{ display: 'flex', gap: 5, marginBottom: 18 }}>{STEPS.map((x, i) => <span key={x} style={bar(i, step)} />)}</div><div style={{ marginBottom: 16 }}><div style={{ color: '#7c3aed', fontSize: 11, fontWeight: 950, textTransform: 'uppercase', marginBottom: 6 }}>{STEPS[step]}</div><h2 style={{ margin: 0, color: 'var(--text-strong)', fontSize: 21 }}>{QUESTIONS[step]}</h2></div>{body()}{error ? <div style={{ marginTop: 12, padding: 9, borderRadius: 12, background: 'rgba(239,68,68,.12)', color: '#fca5a5', fontSize: 12, fontWeight: 800 }}>{error}</div> : null}<div style={{ display: 'flex', gap: 8, marginTop: 16 }}><button type="button" className="btn-primary btn-outline" style={{ flex: 1 }} onClick={() => mode === 'event' && step === 1 ? setStep(0) : setStep(v => Math.max(0, v - 1))} disabled={step === 0 || saving}>Anterior</button>{step < STEPS.length - 1 ? <button type="button" style={{ flex: 1, padding: 11, borderRadius: 13, border: 'none', background: canNext ? 'linear-gradient(135deg,#7c3aed,#4f46e5)' : 'rgba(255,255,255,.08)', color: canNext ? '#fff' : '#6b7280', fontWeight: 900 }} onClick={next} disabled={!canNext || saving}>Siguiente</button> : <button type="button" style={{ flex: 1, padding: 11, borderRadius: 13, border: 'none', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', fontWeight: 900 }} onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Guardar evento'}</button>}</div></div></section>
}
