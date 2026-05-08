'use client'

import { useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { createAvailabilityBlock } from '@/lib/availability-blocks-db'
import { showToast } from '@/lib/toast'
import type { AvailabilityBlockType } from '@/types'

type Props = { onBack: () => void }

const STEPS = ['Tipo', 'Cuándo', 'Motivo', 'Resumen']
const QUESTIONS = ['¿Qué quieres bloquear?', '¿Cuándo no estarás disponible?', '¿Quieres añadir un motivo?', '¿Está todo correcto?']
const today = () => new Date().toISOString().slice(0, 10)
const bar = (i: number, s: number) => ({ flex: 1, height: 5, borderRadius: 999, background: i <= s ? 'linear-gradient(90deg,#f59e0b,#ef4444)' : 'rgba(148,163,184,.24)' })

export function GuidedBlockPanel({ onBack }: Props) {
  const { user } = useAuth()
  const { children, selectedChildId } = useAppStore()
  const child = useMemo(() => children.find(c => c.id === selectedChildId) || null, [children, selectedChildId])
  const isParent = !!child && !!user?.uid && child.parents.includes(user.uid)
  const isCollaborator = !!child && !!user?.uid && !!child.collaborators?.includes(user.uid)
  const canUse = !!child && !!user?.uid && (isParent || isCollaborator)

  const [step, setStep] = useState(0)
  const [type, setType] = useState<AvailabilityBlockType>('full_day')
  const [date, setDate] = useState(today())
  const [startDate, setStartDate] = useState(today())
  const [endDate, setEndDate] = useState(today())
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('14:00')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const valid = type === 'partial_slot'
    ? !!date && !!startTime && !!endTime && startTime < endTime
    : type === 'date_range'
      ? !!startDate && !!endDate && startDate <= endDate
      : !!date
  const canNext = step === 1 ? valid : canUse

  const summaryDate = type === 'full_day'
    ? date
    : type === 'date_range'
      ? `${startDate} → ${endDate}`
      : `${date}, ${startTime}-${endTime}`

  const next = () => {
    if (!canNext) {
      setError(!canUse ? 'No puedes crear bloqueos para este menor.' : 'Completa esta pantalla para continuar.')
      return
    }
    setError('')
    setStep(v => Math.min(STEPS.length - 1, v + 1))
  }

  const save = async () => {
    if (!user || !child || !canUse || !valid || saving) return
    setSaving(true)
    setError('')
    try {
      await createAvailabilityBlock({
        childId: child.id,
        userId: user.uid,
        userName: user.displayName || user.email || 'Usuario',
        ownerRole: isParent ? 'parent' : 'collaborator',
        type,
        date: type === 'full_day' || type === 'partial_slot' ? date : undefined,
        startDate: type === 'date_range' ? startDate : undefined,
        endDate: type === 'date_range' ? endDate : undefined,
        startTime: type === 'partial_slot' ? startTime : undefined,
        endTime: type === 'partial_slot' ? endTime : undefined,
        note: note.trim() || undefined,
      })
      showToast({ message: 'Bloqueo guardado.', tone: 'success' })
      window.dispatchEvent(new CustomEvent('custodia:navigate', { detail: { tab: 'requests', childId: child.id, date: type === 'date_range' ? startDate : date } }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo guardar el bloqueo.'
      setError(message)
      showToast({ message, tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const body = () => {
    if (step === 0) return <div className="type-toggle"><button type="button" className={`type-btn ${type === 'full_day' ? 'active' : ''}`} onClick={() => setType('full_day')}>Día completo</button><button type="button" className={`type-btn ${type === 'date_range' ? 'active' : ''}`} onClick={() => setType('date_range')}>Rango</button><button type="button" className={`type-btn ${type === 'partial_slot' ? 'active' : ''}`} onClick={() => setType('partial_slot')}>Horario</button></div>
    if (step === 1) {
      if (type === 'date_range') return <div className="date-pair"><label><div className="date-pair-label">Desde</div><input type="date" className="settings-input" value={startDate} onChange={e => { const d = e.target.value; setStartDate(d); if (!endDate || endDate < d) setEndDate(d) }} /></label><label><div className="date-pair-label">Hasta</div><input type="date" className="settings-input" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} /></label></div>
      return <div style={{ display: 'grid', gap: 10 }}><label><div className="settings-label">Fecha</div><input type="date" className="settings-input" value={date} onChange={e => setDate(e.target.value)} /></label>{type === 'partial_slot' ? <div className="date-pair"><label><div className="date-pair-label">Hora desde</div><input type="time" className="settings-input" value={startTime} onChange={e => setStartTime(e.target.value)} /></label><label><div className="date-pair-label">Hora hasta</div><input type="time" className="settings-input" value={endTime} min={startTime} onChange={e => setEndTime(e.target.value)} /></label></div> : null}</div>
    }
    if (step === 2) return <div><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>{['Trabajo', 'Viaje', 'Médico', 'Personal', 'Vacaciones'].map(x => <button key={x} type="button" onClick={() => setNote(x)} style={{ border: '1px solid var(--border)', borderRadius: 999, background: 'var(--bg-soft)', color: 'var(--text-secondary)', padding: '7px 10px', fontWeight: 800 }}>{x}</button>)}</div><textarea className="settings-textarea" rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="Médico, viaje, trabajo, no disponible..." /></div>
    const rows = [['Menor', child?.name || '—'], ['Bloquea a', user?.displayName || user?.email || 'Usuario'], ['Tipo', type === 'full_day' ? 'Día completo' : type === 'date_range' ? 'Rango de fechas' : 'Horario concreto'], ['Cuándo', summaryDate], ['Motivo', note.trim() || 'Sin motivo']]
    return <div style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 20, background: 'var(--bg-card)' }}>{rows.map(([l, v]) => <div key={l} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 12 }}><strong>{l}</strong><span style={{ color: 'var(--text-strong)', fontWeight: 900, textAlign: 'right' }}>{v}</span></div>)}</div>
  }

  return <section style={{ display: 'grid', gap: 14, width: '100%', maxWidth: 620, margin: '0 auto', paddingBottom: 18 }}><div className="card" style={{ padding: 18, borderRadius: 26, background: 'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-soft) 100%)', border: '1px solid rgba(245,158,11,.24)' }}><div style={{ color: '#f59e0b', fontSize: 10, fontWeight: 950, letterSpacing: .5, textTransform: 'uppercase', marginBottom: 5 }}>Bloqueo guiado</div><h1 style={{ margin: 0, color: 'var(--text-strong)', fontSize: 24, lineHeight: 1.05 }}>Bloquear disponibilidad</h1><p style={{ margin: '8px 0 0', color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.45 }}>Indica cuándo no pueden asignarte eventos o cambios para {child?.name || 'el menor seleccionado'}.</p></div><div className="card" style={{ padding: 16, borderRadius: 26, background: 'var(--bg-card)', border: '1px solid var(--border)' }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}><span style={{ background: 'rgba(245,158,11,.12)', color: '#f59e0b', borderRadius: 999, padding: '6px 9px', fontSize: 11, fontWeight: 950 }}>Paso {step + 1} de {STEPS.length}</span><span style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 850 }}>{STEPS[step]}</span></div><div style={{ display: 'flex', gap: 5, marginBottom: 18 }}>{STEPS.map((x, i) => <span key={x} style={bar(i, step)} />)}</div><div style={{ marginBottom: 16 }}><div style={{ color: '#f59e0b', fontSize: 11, fontWeight: 950, textTransform: 'uppercase', marginBottom: 6 }}>{STEPS[step]}</div><h2 style={{ margin: 0, color: 'var(--text-strong)', fontSize: 21 }}>{QUESTIONS[step]}</h2></div>{body()}{error ? <div style={{ marginTop: 12, padding: 9, borderRadius: 12, background: 'rgba(239,68,68,.12)', color: '#fca5a5', fontSize: 12, fontWeight: 800 }}>{error}</div> : null}<div style={{ display: 'flex', gap: 8, marginTop: 16 }}><button type="button" className="btn-primary btn-outline" style={{ flex: 1 }} onClick={() => step === 0 ? onBack() : setStep(v => Math.max(0, v - 1))} disabled={saving}>Anterior</button>{step < STEPS.length - 1 ? <button type="button" style={{ flex: 1, padding: 11, borderRadius: 13, border: 'none', background: canNext ? 'linear-gradient(135deg,#f59e0b,#ef4444)' : 'rgba(255,255,255,.08)', color: canNext ? '#fff' : '#6b7280', fontWeight: 900 }} onClick={next} disabled={!canNext || saving}>Siguiente</button> : <button type="button" style={{ flex: 1, padding: 11, borderRadius: 13, border: 'none', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', color: '#fff', fontWeight: 900 }} onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Guardar bloqueo'}</button>}</div></div></section>
}
