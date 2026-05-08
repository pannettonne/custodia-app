'use client'

import { useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { createChangeRequest, createNotification } from '@/lib/db'
import { getAvailabilityBlocksForUser } from '@/lib/availability-blocks-db'
import { findAvailabilityConflict, getAvailabilityConflictMessage } from '@/lib/availability-blocks'
import { showToast } from '@/lib/toast'
import { GuidedLocationStep2 } from './GuidedLocationStep2'

type Props = { onBack: () => void }

const STEPS = ['Tipo', 'Fechas', 'Dónde', 'Motivo', 'Resumen']
const QUESTIONS = ['¿Qué tipo de cambio necesitas?', '¿Qué día o período quieres cambiar?', '¿Hay algún lugar asociado?', '¿Cuál es el motivo?', '¿Está todo correcto?']
const today = () => new Date().toISOString().slice(0, 10)
const bar = (i: number, s: number) => ({ flex: 1, height: 5, borderRadius: 999, background: i <= s ? 'linear-gradient(90deg,#10b981,#3b82f6)' : 'rgba(148,163,184,.24)' })

export function GuidedChangePanel({ onBack }: Props) {
  const { user } = useAuth()
  const { children, selectedChildId } = useAppStore()
  const child = useMemo(() => children.find(c => c.id === selectedChildId) || null, [children, selectedChildId])
  const otherParentId = useMemo(() => child?.parents.find(p => p !== user?.uid) || null, [child, user])
  const otherParentName = otherParentId ? child?.parentNames?.[otherParentId] || 'El otro progenitor' : '—'
  const [step, setStep] = useState(0)
  const [type, setType] = useState<'single' | 'range'>('single')
  const [date, setDate] = useState(today())
  const [startDate, setStartDate] = useState(today())
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [locationName, setLocationName] = useState('')
  const [locationAddress, setLocationAddress] = useState('')
  const [locationLatitude, setLocationLatitude] = useState<number | undefined>()
  const [locationLongitude, setLocationLongitude] = useState<number | undefined>()
  const [locationPlaceId, setLocationPlaceId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const validDates = type === 'single' ? !!date : !!startDate && !!endDate && startDate <= endDate
  const canNext = step === 1 ? validDates : step === 3 ? reason.trim().length > 0 : !!child && !!otherParentId
  const summaryDate = type === 'single' ? date : `${startDate} → ${endDate}`
  const targetDate = type === 'single' ? date : startDate
  const summaryLocation = locationName.trim() || locationAddress.trim()

  const next = () => {
    if (!canNext) {
      setError(!otherParentId ? 'Hace falta otro progenitor para solicitar un cambio.' : 'Completa esta pantalla para continuar.')
      return
    }
    setError('')
    setStep(v => Math.min(STEPS.length - 1, v + 1))
  }

  const send = async () => {
    if (!user || !child || !otherParentId || saving || !validDates || !reason.trim()) return
    setSaving(true)
    setError('')
    try {
      const blocks = await getAvailabilityBlocksForUser(child.id, otherParentId)
      const conflict = findAvailabilityConflict({ blocks, startDate: type === 'single' ? date : startDate, endDate: type === 'single' ? date : endDate })
      if (conflict) throw new Error(getAvailabilityConflictMessage(otherParentName, conflict))
      await createChangeRequest({ childId: child.id, fromParentId: user.uid, fromParentName: user.displayName || user.email || 'Progenitor', toParentId: otherParentId, type, ...(type === 'single' ? { date } : { startDate, endDate }), reason: reason.trim(), locationName: locationName.trim() || undefined, locationAddress: locationAddress.trim() || undefined, locationLatitude, locationLongitude, locationPlaceId: locationPlaceId || undefined })
      await createNotification({ userId: otherParentId, childId: child.id, childName: child.name, type: 'pending_request', title: 'Nueva solicitud de cambio', body: `${user.displayName || user.email || 'El otro progenitor'} ha pedido un cambio de custodia (${summaryDate})${summaryLocation ? ` · ${summaryLocation}` : ''}.`, dateKey: `change-request:${child.id}:${summaryDate}:${Date.now()}`, targetTab: 'requests', targetDate })
      showToast({ message: 'Solicitud enviada.', tone: 'success' })
      window.dispatchEvent(new CustomEvent('custodia:navigate', { detail: { tab: 'requests', childId: child.id, date: targetDate } }))
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo enviar la solicitud.'
      setError(message)
      showToast({ message, tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const body = () => {
    if (step === 0) return <div className="type-toggle"><button type="button" className={`type-btn ${type === 'single' ? 'active' : ''}`} onClick={() => setType('single')}>Día concreto</button><button type="button" className={`type-btn ${type === 'range' ? 'active' : ''}`} onClick={() => { setType('range'); if (!endDate) setEndDate(startDate) }}>Rango de fechas</button></div>
    if (step === 1) return type === 'single' ? <label><div className="settings-label">Fecha</div><input className="settings-input" type="date" value={date} onChange={e => setDate(e.target.value)} /></label> : <div className="date-pair"><label><div className="date-pair-label">Desde</div><input className="settings-input" type="date" value={startDate} onChange={e => { const d = e.target.value; setStartDate(d); if (!endDate || endDate < d) setEndDate(d) }} /></label><label><div className="date-pair-label">Hasta</div><input className="settings-input" type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} /></label></div>
    if (step === 2) return <GuidedLocationStep2 locationName={locationName} setLocationName={setLocationName} locationAddress={locationAddress} setLocationAddress={setLocationAddress} setLocationLatitude={setLocationLatitude} setLocationLongitude={setLocationLongitude} setLocationPlaceId={setLocationPlaceId} />
    if (step === 3) return <textarea className="settings-textarea" rows={4} value={reason} onChange={e => setReason(e.target.value)} placeholder="Explica brevemente el motivo del cambio..." />
    const rows = [['Menor', child?.name || '—'], ['Se enviará a', otherParentName], ['Tipo', type === 'single' ? 'Día concreto' : 'Rango de fechas'], ['Fecha', summaryDate], ['Lugar', summaryLocation || 'Sin lugar'], ['Motivo', reason.trim() || '—']]
    return <div style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 20, background: 'var(--bg-card)' }}>{rows.map(([l, v]) => <div key={l} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 12 }}><strong>{l}</strong><span style={{ color: 'var(--text-strong)', fontWeight: 900, textAlign: 'right' }}>{v}</span></div>)}</div>
  }

  return <section style={{ display: 'grid', gap: 14, width: '100%', maxWidth: 620, margin: '0 auto', paddingBottom: 18 }}><div className="card" style={{ padding: 18, borderRadius: 26, background: 'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-soft) 100%)', border: '1px solid rgba(16,185,129,.24)' }}><div style={{ color: '#10b981', fontSize: 10, fontWeight: 950, letterSpacing: .5, textTransform: 'uppercase', marginBottom: 5 }}>Cambio guiado</div><h1 style={{ margin: 0, color: 'var(--text-strong)', fontSize: 24, lineHeight: 1.05 }}>Solicitar cambio</h1><p style={{ margin: '8px 0 0', color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.45 }}>Crea una solicitud para {child?.name || 'el menor seleccionado'} paso a paso.</p></div><div className="card" style={{ padding: 16, borderRadius: 26, background: 'var(--bg-card)', border: '1px solid var(--border)' }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}><span style={{ background: 'rgba(16,185,129,.12)', color: '#10b981', borderRadius: 999, padding: '6px 9px', fontSize: 11, fontWeight: 950 }}>Paso {step + 1} de {STEPS.length}</span><span style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 850 }}>{STEPS[step]}</span></div><div style={{ display: 'flex', gap: 5, marginBottom: 18 }}>{STEPS.map((x, i) => <span key={x} style={bar(i, step)} />)}</div><div style={{ marginBottom: 16 }}><div style={{ color: '#10b981', fontSize: 11, fontWeight: 950, textTransform: 'uppercase', marginBottom: 6 }}>{STEPS[step]}</div><h2 style={{ margin: 0, color: 'var(--text-strong)', fontSize: 21 }}>{QUESTIONS[step]}</h2></div>{body()}{error ? <div style={{ marginTop: 12, padding: 9, borderRadius: 12, background: 'rgba(239,68,68,.12)', color: '#fca5a5', fontSize: 12, fontWeight: 800 }}>{error}</div> : null}<div style={{ display: 'flex', gap: 8, marginTop: 16 }}><button type="button" className="btn-primary btn-outline" style={{ flex: 1 }} onClick={() => step === 0 ? onBack() : setStep(v => Math.max(0, v - 1))} disabled={saving}>Anterior</button>{step < STEPS.length - 1 ? <button type="button" style={{ flex: 1, padding: 11, borderRadius: 13, border: 'none', background: canNext ? 'linear-gradient(135deg,#10b981,#3b82f6)' : 'rgba(255,255,255,.08)', color: canNext ? '#fff' : '#6b7280', fontWeight: 900 }} onClick={next} disabled={!canNext || saving}>Siguiente</button> : <button type="button" style={{ flex: 1, padding: 11, borderRadius: 13, border: 'none', background: 'linear-gradient(135deg,#10b981,#3b82f6)', color: '#fff', fontWeight: 900 }} onClick={send} disabled={saving}>{saving ? 'Enviando...' : 'Enviar solicitud'}</button>}</div></div></section>
}
