'use client'

import { useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { createNote, createNotification } from '@/lib/db'
import { showToast } from '@/lib/toast'
import { DocumentAssociations } from '@/components/documents/DocumentAssociations'
import type { NoteTag } from '@/types'

type Props = { onBack: () => void }

const STEPS = ['Tipo', 'Cuándo', 'Contenido', 'Opciones', 'Resumen']
const QUESTIONS = ['¿Qué tipo de nota quieres crear?', '¿A qué fecha corresponde?', '¿Qué quieres anotar?', '¿Quieres añadir algo más?', '¿Está todo correcto?']
const today = () => new Date().toISOString().slice(0, 10)
const bar = (i: number, s: number) => ({ flex: 1, height: 5, borderRadius: 999, background: i <= s ? 'linear-gradient(90deg,#3b82f6,#8b5cf6)' : 'rgba(148,163,184,.24)' })

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 14, border: '1px solid var(--border)', borderRadius: 18, background: checked ? 'rgba(59,130,246,.10)' : 'var(--bg-card)' }}><span><strong>{label}</strong><br /><small style={{ color: 'var(--text-secondary)' }}>{hint}</small></span><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} /></label>
}

export function GuidedNotePanel({ onBack }: Props) {
  const { user } = useAuth()
  const { children, selectedChildId } = useAppStore()
  const child = useMemo(() => children.find(c => c.id === selectedChildId) || null, [children, selectedChildId])
  const canUse = !!child && !!user?.uid && (child.parents.includes(user.uid) || !!child.collaborators?.includes(user.uid))
  const otherParentIds = useMemo(() => child && user ? child.parents.filter(id => id !== user.uid) : [], [child, user])
  const [step, setStep] = useState(0)
  const [type, setType] = useState<'single' | 'range'>('single')
  const [date, setDate] = useState(today())
  const [startDate, setStartDate] = useState(today())
  const [endDate, setEndDate] = useState(today())
  const [tag, setTag] = useState<NoteTag>('info')
  const [text, setText] = useState('')
  const [mentionOther, setMentionOther] = useState(false)
  const [documentsEnabled, setDocumentsEnabled] = useState(false)
  const [documentIds, setDocumentIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const validDate = type === 'single' ? !!date : !!startDate && !!endDate && startDate <= endDate
  const canNext = !canUse ? false : step === 1 ? validDate : step === 2 ? text.trim().length > 0 : true
  const summaryDate = type === 'single' ? date : `${startDate} → ${endDate}`
  const targetDate = type === 'single' ? date : startDate

  const next = () => {
    if (!canNext) {
      setError(!canUse ? 'No puedes crear notas para este menor.' : 'Completa esta pantalla para continuar.')
      return
    }
    setError('')
    setStep(v => Math.min(STEPS.length - 1, v + 1))
  }

  const save = async () => {
    if (!user || !child || !canUse || saving || !validDate || !text.trim()) return
    setSaving(true)
    setError('')
    try {
      await createNote({
        childId: child.id,
        createdBy: user.uid,
        createdByName: user.displayName || user.email || 'Usuario',
        type,
        date: type === 'single' ? date : undefined,
        startDate: type === 'range' ? startDate : undefined,
        endDate: type === 'range' ? endDate : undefined,
        text: text.trim(),
        tag,
        mentionOther,
        read: false,
        documentIds: documentsEnabled ? documentIds : [],
      })
      if (mentionOther && otherParentIds.length > 0) {
        await Promise.all(otherParentIds.map(userId => createNotification({
          userId,
          childId: child.id,
          childName: child.name,
          type: 'pending_request',
          title: 'Nueva nota compartida',
          body: `${user.displayName || user.email || 'Alguien'} ha añadido una nota para ${summaryDate}.`,
          dateKey: `note:${child.id}:${summaryDate}:${Date.now()}:${userId}`,
          targetTab: 'notes',
          targetDate,
        })))
      }
      showToast({ message: 'Nota guardada.', tone: 'success' })
      window.dispatchEvent(new CustomEvent('custodia:navigate', { detail: { tab: 'notes', childId: child.id, date: targetDate } }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo guardar la nota.'
      setError(message)
      showToast({ message, tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const body = () => {
    if (step === 0) return <div style={{ display: 'grid', gap: 10 }}><div className="type-toggle"><button type="button" className={`type-btn ${type === 'single' ? 'active' : ''}`} onClick={() => setType('single')}>Día concreto</button><button type="button" className={`type-btn ${type === 'range' ? 'active' : ''}`} onClick={() => setType('range')}>Rango</button></div><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{(['info', 'importante', 'urgente'] as NoteTag[]).map(x => <button key={x} type="button" onClick={() => setTag(x)} style={{ border: `1px solid ${tag === x ? '#3b82f6' : 'var(--border)'}`, borderRadius: 999, background: tag === x ? 'rgba(59,130,246,.10)' : 'var(--bg-soft)', color: tag === x ? '#60a5fa' : 'var(--text-secondary)', padding: '7px 10px', fontWeight: 800 }}>{x === 'info' ? 'Info' : x === 'importante' ? 'Importante' : 'Urgente'}</button>)}</div></div>
    if (step === 1) return type === 'single' ? <label><div className="settings-label">Fecha</div><input type="date" className="settings-input" value={date} onChange={e => setDate(e.target.value)} /></label> : <div className="date-pair"><label><div className="date-pair-label">Desde</div><input type="date" className="settings-input" value={startDate} onChange={e => { const d = e.target.value; setStartDate(d); if (!endDate || endDate < d) setEndDate(d) }} /></label><label><div className="date-pair-label">Hasta</div><input type="date" className="settings-input" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} /></label></div>
    if (step === 2) return <div><textarea className="settings-textarea" rows={5} value={text} onChange={e => setText(e.target.value)} placeholder="Escribe la nota..." /><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>{['Recoger material', 'Aviso del colegio', 'Tema médico', 'Importante para el cambio'].map(x => <button key={x} type="button" onClick={() => setText(prev => prev ? `${prev}\n${x}` : x)} style={{ border: '1px solid var(--border)', borderRadius: 999, background: 'var(--bg-soft)', color: 'var(--text-secondary)', padding: '7px 10px', fontWeight: 800 }}>{x}</button>)}</div></div>
    if (step === 3) return <div style={{ display: 'grid', gap: 12 }}><Toggle label="Avisar al otro progenitor" hint="Crear una notificación para que revise la nota" checked={mentionOther} onChange={setMentionOther} /><Toggle label="Documentos" hint="Asociar archivos existentes o subir uno nuevo" checked={documentsEnabled} onChange={setDocumentsEnabled} />{documentsEnabled && child ? <DocumentAssociations childId={child.id} value={documentIds} onChange={setDocumentIds} /> : null}</div>
    const rows = [['Menor', child?.name || '—'], ['Tipo', type === 'single' ? 'Día concreto' : 'Rango'], ['Fecha', summaryDate], ['Etiqueta', tag === 'info' ? 'Info' : tag === 'importante' ? 'Importante' : 'Urgente'], ['Aviso', mentionOther ? 'Sí' : 'No'], ['Documentos', documentsEnabled && documentIds.length ? String(documentIds.length) : 'No'], ['Nota', text.trim() || '—']]
    return <div style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 20, background: 'var(--bg-card)' }}>{rows.map(([l, v]) => <div key={l} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 12 }}><strong>{l}</strong><span style={{ color: 'var(--text-strong)', fontWeight: 900, textAlign: 'right', maxWidth: l === 'Nota' ? 260 : undefined, whiteSpace: l === 'Nota' ? 'pre-wrap' : undefined }}>{v}</span></div>)}</div>
  }

  return <section style={{ display: 'grid', gap: 14, width: '100%', maxWidth: 620, margin: '0 auto', paddingBottom: 18 }}><div className="card" style={{ padding: 18, borderRadius: 26, background: 'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-soft) 100%)', border: '1px solid rgba(59,130,246,.24)' }}><div style={{ color: '#3b82f6', fontSize: 10, fontWeight: 950, letterSpacing: .5, textTransform: 'uppercase', marginBottom: 5 }}>Nota guiada</div><h1 style={{ margin: 0, color: 'var(--text-strong)', fontSize: 24, lineHeight: 1.05 }}>Añadir nota</h1><p style={{ margin: '8px 0 0', color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.45 }}>Registra una nota para {child?.name || 'el menor seleccionado'} de forma rápida.</p></div><div className="card" style={{ padding: 16, borderRadius: 26, background: 'var(--bg-card)', border: '1px solid var(--border)' }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}><span style={{ background: 'rgba(59,130,246,.12)', color: '#60a5fa', borderRadius: 999, padding: '6px 9px', fontSize: 11, fontWeight: 950 }}>Paso {step + 1} de {STEPS.length}</span><span style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 850 }}>{STEPS[step]}</span></div><div style={{ display: 'flex', gap: 5, marginBottom: 18 }}>{STEPS.map((x, i) => <span key={x} style={bar(i, step)} />)}</div><div style={{ marginBottom: 16 }}><div style={{ color: '#3b82f6', fontSize: 11, fontWeight: 950, textTransform: 'uppercase', marginBottom: 6 }}>{STEPS[step]}</div><h2 style={{ margin: 0, color: 'var(--text-strong)', fontSize: 21 }}>{QUESTIONS[step]}</h2></div>{body()}{error ? <div style={{ marginTop: 12, padding: 9, borderRadius: 12, background: 'rgba(239,68,68,.12)', color: '#fca5a5', fontSize: 12, fontWeight: 800 }}>{error}</div> : null}<div style={{ display: 'flex', gap: 8, marginTop: 16 }}><button type="button" className="btn-primary btn-outline" style={{ flex: 1 }} onClick={() => step === 0 ? onBack() : setStep(v => Math.max(0, v - 1))} disabled={saving}>Anterior</button>{step < STEPS.length - 1 ? <button type="button" style={{ flex: 1, padding: 11, borderRadius: 13, border: 'none', background: canNext ? 'linear-gradient(135deg,#3b82f6,#8b5cf6)' : 'rgba(255,255,255,.08)', color: canNext ? '#fff' : '#6b7280', fontWeight: 900 }} onClick={next} disabled={!canNext || saving}>Siguiente</button> : <button type="button" style={{ flex: 1, padding: 11, borderRadius: 13, border: 'none', background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', color: '#fff', fontWeight: 900 }} onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Guardar nota'}</button>}</div></div></section>
}
