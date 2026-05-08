'use client'

import { useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { createMedicationPlan, updateMedicationPlan } from '@/lib/medications-db'
import { showToast } from '@/lib/toast'
import type { MedicationPlan } from '@/types'

type Props = { onBack: () => void; onDone?: () => void; editItem?: MedicationPlan | null }

const STEPS = ['Tipo', 'Nombre', 'Dosis', 'Frecuencia', 'Fechas', 'Instrucciones', 'Recordatorio', 'Resumen']
const QUESTIONS = ['¿Qué tratamiento quieres añadir?', '¿Cómo se llama?', '¿Qué dosis hay que administrar?', '¿Cada cuánto se administra?', '¿Durante qué período?', '¿Hay instrucciones importantes?', '¿Quieres activar recordatorio?', '¿Está todo correcto?']
const UNITS = ['ml', 'mg', 'comprimido(s)', 'gota(s)', 'puff(s)', 'sobre(s)', 'aplicación']
const ROUTES = ['Oral', 'Inhalada', 'Tópica', 'Nasal', 'Ocular', 'Otra']
const REMINDERS = [0, 10, 30, 60]
const today = () => new Date().toISOString().slice(0, 10)
const bar = (i: number, s: number) => ({ flex: 1, height: 5, borderRadius: 999, background: i <= s ? 'linear-gradient(90deg,#ef4444,#ec4899)' : 'rgba(148,163,184,.24)' })

export function GuidedTreatmentPanel({ onBack, onDone, editItem = null }: Props) {
  const { user } = useAuth()
  const { children, selectedChildId } = useAppStore()
  const child = useMemo(() => children.find(c => c.id === selectedChildId) || null, [children, selectedChildId])
  const canUse = !!child && !!user?.uid && child.parents.includes(user.uid)
  const isEditing = !!editItem?.id
  const [step, setStep] = useState(0)
  const [kind, setKind] = useState<'medication' | 'therapy' | 'care' | 'other'>('medication')
  const [name, setName] = useState(editItem?.name || '')
  const [dosage, setDosage] = useState(editItem?.dosage || '')
  const [dosageUnit, setDosageUnit] = useState(editItem?.dosageUnit || 'ml')
  const [route, setRoute] = useState(editItem?.route || 'Oral')
  const [intervalHours, setIntervalHours] = useState(String(editItem?.intervalHours || 8))
  const [firstDoseTime, setFirstDoseTime] = useState(editItem?.firstDoseTime || '08:00')
  const [startDate, setStartDate] = useState(editItem?.startDate || today())
  const [endDate, setEndDate] = useState(editItem?.endDate || today())
  const [instructions, setInstructions] = useState(editItem?.instructions || '')
  const [observations, setObservations] = useState(editItem?.observations || '')
  const [reminderEnabled, setReminderEnabled] = useState(editItem?.reminderEnabled ?? true)
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState(editItem?.reminderMinutesBefore ?? 30)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const validDates = !!startDate && !!endDate && startDate <= endDate
  const validInterval = Number(intervalHours) > 0
  const canNext = !canUse ? false : step === 0 ? kind === 'medication' : step === 1 ? !!name.trim() : step === 2 ? !!dosage.trim() : step === 3 ? validInterval && !!firstDoseTime : step === 4 ? validDates : true

  const next = () => {
    if (!canNext) {
      setError(!canUse ? 'Solo un progenitor puede crear tratamientos.' : kind !== 'medication' ? 'De momento solo está activo Medicación.' : 'Completa esta pantalla para continuar.')
      return
    }
    setError('')
    setStep(v => Math.min(STEPS.length - 1, v + 1))
  }

  const save = async () => {
    if (!user || !child || !canUse || saving || !name.trim() || !dosage.trim() || !validInterval || !validDates) return
    setSaving(true)
    setError('')
    try {
      const payload = {
        childId: child.id,
        createdBy: editItem?.createdBy || user.uid,
        createdByName: editItem?.createdByName || user.displayName || user.email || 'Progenitor',
        name: name.trim(),
        dosage: dosage.trim(),
        dosageUnit,
        route,
        intervalHours: Number(intervalHours),
        firstDoseTime,
        startDate,
        endDate,
        instructions: instructions.trim() || undefined,
        observations: observations.trim() || undefined,
        status: editItem?.status || 'active',
        reminderEnabled,
        reminderMinutesBefore: reminderEnabled ? reminderMinutesBefore : undefined,
      }
      if (isEditing && editItem) {
        await updateMedicationPlan(editItem.id, payload)
        showToast({ message: 'Tratamiento actualizado.', tone: 'success' })
        window.dispatchEvent(new CustomEvent('custodia:navigate', { detail: { tab: 'medications', childId: child.id, date: startDate } }))
        onDone?.()
        return
      }
      await createMedicationPlan(payload)
      showToast({ message: 'Tratamiento guardado.', tone: 'success' })
      window.dispatchEvent(new CustomEvent('custodia:navigate', { detail: { tab: 'medications', childId: child.id, date: startDate } }))
    } catch (err) {
      const message = err instanceof Error ? err.message : isEditing ? 'No se pudo actualizar el tratamiento.' : 'No se pudo guardar el tratamiento.'
      setError(message)
      showToast({ message, tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const body = () => {
    if (step === 0) return <div style={{ display: 'grid', gap: 10 }}>{[['medication', 'Medicación', 'Medicamentos con dosis, frecuencia y recordatorios.'], ['therapy', 'Terapia / rehabilitación', 'Próximamente.'], ['care', 'Cuidado recurrente', 'Próximamente.'], ['other', 'Otro', 'Próximamente.']].map(([id, label, hint]) => <button key={id} type="button" onClick={() => id === 'medication' ? setKind('medication') : showToast({ message: 'Ese tipo lo añadiremos después.', tone: 'info' })} style={{ padding: 12, borderRadius: 18, border: `1px solid ${kind === id ? '#ef4444' : 'var(--border)'}`, background: kind === id ? 'rgba(239,68,68,.10)' : 'var(--bg-card)', color: 'var(--text-strong)', textAlign: 'left' }}><strong>{label}</strong><br /><small style={{ color: 'var(--text-secondary)' }}>{hint}</small></button>)}</div>
    if (step === 1) return <div><input className="settings-input" value={name} onChange={e => setName(e.target.value)} placeholder="Nombre del medicamento" /><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>{['Ibuprofeno', 'Antibiótico', 'Jarabe', 'Aerosol', 'Crema'].map(x => <button key={x} type="button" onClick={() => setName(x)} style={{ border: '1px solid var(--border)', borderRadius: 999, background: 'var(--bg-soft)', color: 'var(--text-secondary)', padding: '7px 10px', fontWeight: 800 }}>{x}</button>)}</div></div>
    if (step === 2) return <div style={{ display: 'grid', gap: 10 }}><div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Introduce la dosis indicada por el profesional sanitario.</div><div className="date-pair"><input className="settings-input" value={dosage} onChange={e => setDosage(e.target.value)} placeholder="Cantidad" /><select className="settings-select" value={dosageUnit} onChange={e => setDosageUnit(e.target.value)}>{UNITS.map(x => <option key={x} value={x}>{x}</option>)}</select></div><select className="settings-select" value={route} onChange={e => setRoute(e.target.value)}>{ROUTES.map(x => <option key={x} value={x}>Vía {x.toLowerCase()}</option>)}</select></div>
    if (step === 3) return <div style={{ display: 'grid', gap: 10 }}><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{[8, 12, 24].map(x => <button key={x} type="button" onClick={() => setIntervalHours(String(x))} style={{ border: `1px solid ${intervalHours === String(x) ? '#ef4444' : 'var(--border)'}`, borderRadius: 999, background: intervalHours === String(x) ? 'rgba(239,68,68,.10)' : 'var(--bg-soft)', color: intervalHours === String(x) ? '#f87171' : 'var(--text-secondary)', padding: '7px 10px', fontWeight: 800 }}>Cada {x} h</button>)}</div><label><div className="settings-label">Cada cuántas horas</div><input className="settings-input" type="number" min="1" value={intervalHours} onChange={e => setIntervalHours(e.target.value)} /></label><label><div className="settings-label">Primera toma</div><input className="settings-input" type="time" value={firstDoseTime} onChange={e => setFirstDoseTime(e.target.value)} /></label></div>
    if (step === 4) return <div className="date-pair"><label><div className="date-pair-label">Fecha inicio</div><input className="settings-input" type="date" value={startDate} onChange={e => { const d = e.target.value; setStartDate(d); if (!endDate || endDate < d) setEndDate(d) }} /></label><label><div className="date-pair-label">Fecha fin</div><input className="settings-input" type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} /></label></div>
    if (step === 5) return <div style={{ display: 'grid', gap: 10 }}><textarea className="settings-textarea" rows={3} value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="Instrucciones: con comida, antes de dormir, etc." /><textarea className="settings-textarea" rows={3} value={observations} onChange={e => setObservations(e.target.value)} placeholder="Observaciones internas opcionales" /></div>
    if (step === 6) return <div style={{ display: 'grid', gap: 10 }}><label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 14, border: '1px solid var(--border)', borderRadius: 18, background: reminderEnabled ? 'rgba(239,68,68,.10)' : 'var(--bg-card)' }}><span><strong>Recordatorio</strong><br /><small style={{ color: 'var(--text-secondary)' }}>Avisar antes de cada toma</small></span><input type="checkbox" checked={reminderEnabled} onChange={e => setReminderEnabled(e.target.checked)} /></label>{reminderEnabled ? <select className="settings-select" value={reminderMinutesBefore} onChange={e => setReminderMinutesBefore(Number(e.target.value))}>{REMINDERS.map(x => <option key={x} value={x}>{x === 0 ? 'A la hora exacta' : `${x} min antes`}</option>)}</select> : null}</div>
    const rows = [['Menor', child?.name || '—'], ['Tratamiento', name], ['Dosis', `${dosage} ${dosageUnit}`], ['Vía', route], ['Frecuencia', `Cada ${intervalHours} h`], ['Primera toma', firstDoseTime], ['Periodo', `${startDate} → ${endDate}`], ['Recordatorio', reminderEnabled ? `${reminderMinutesBefore === 0 ? 'A la hora exacta' : `${reminderMinutesBefore} min antes`}` : 'No']]
    return <div style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 20, background: 'var(--bg-card)' }}>{rows.map(([l, v]) => <div key={l} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 12 }}><strong>{l}</strong><span style={{ color: 'var(--text-strong)', fontWeight: 900, textAlign: 'right' }}>{v}</span></div>)}</div>
  }

  return <section style={{ display: 'grid', gap: 14, width: '100%', maxWidth: 620, margin: '0 auto', paddingBottom: 18 }}><div className="card" style={{ padding: 18, borderRadius: 26, background: 'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-soft) 100%)', border: '1px solid rgba(239,68,68,.24)' }}><div style={{ color: '#ef4444', fontSize: 10, fontWeight: 950, letterSpacing: .5, textTransform: 'uppercase', marginBottom: 5 }}>{isEditing ? 'Edición guiada' : 'Tratamiento guiado'}</div><h1 style={{ margin: 0, color: 'var(--text-strong)', fontSize: 24, lineHeight: 1.05 }}>{isEditing ? 'Editar tratamiento' : 'Añadir tratamiento'}</h1><p style={{ margin: '8px 0 0', color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.45 }}>Registra la pauta indicada para {child?.name || 'el menor seleccionado'}.</p></div><div className="card" style={{ padding: 16, borderRadius: 26, background: 'var(--bg-card)', border: '1px solid var(--border)' }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}><span style={{ background: 'rgba(239,68,68,.12)', color: '#f87171', borderRadius: 999, padding: '6px 9px', fontSize: 11, fontWeight: 950 }}>Paso {step + 1} de {STEPS.length}</span><span style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 850 }}>{STEPS[step]}</span></div><div style={{ display: 'flex', gap: 5, marginBottom: 18 }}>{STEPS.map((x, i) => <span key={x} style={bar(i, step)} />)}</div><div style={{ marginBottom: 16 }}><div style={{ color: '#ef4444', fontSize: 11, fontWeight: 950, textTransform: 'uppercase', marginBottom: 6 }}>{STEPS[step]}</div><h2 style={{ margin: 0, color: 'var(--text-strong)', fontSize: 21 }}>{QUESTIONS[step]}</h2></div>{body()}{error ? <div style={{ marginTop: 12, padding: 9, borderRadius: 12, background: 'rgba(239,68,68,.12)', color: '#fca5a5', fontSize: 12, fontWeight: 800 }}>{error}</div> : null}<div style={{ display: 'flex', gap: 8, marginTop: 16 }}><button type="button" className="btn-primary btn-outline" style={{ flex: 1 }} onClick={() => step === 0 ? onBack() : setStep(v => Math.max(0, v - 1))} disabled={saving}>Anterior</button>{step < STEPS.length - 1 ? <button type="button" style={{ flex: 1, padding: 11, borderRadius: 13, border: 'none', background: canNext ? 'linear-gradient(135deg,#ef4444,#ec4899)' : 'rgba(255,255,255,.08)', color: canNext ? '#fff' : '#6b7280', fontWeight: 900 }} onClick={next} disabled={!canNext || saving}>Siguiente</button> : <button type="button" style={{ flex: 1, padding: 11, borderRadius: 13, border: 'none', background: 'linear-gradient(135deg,#ef4444,#ec4899)', color: '#fff', fontWeight: 900 }} onClick={save} disabled={saving}>{saving ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Guardar tratamiento'}</button>}</div></div></section>
}
