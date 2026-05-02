'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { createNote } from '@/lib/db'
import { showToast } from '@/lib/toast'
import { formatDate } from '@/lib/utils'
import { EventForm } from '@/components/events/location/EventForm'
import type { NoteTag } from '@/types'

type ComposerType = 'note' | 'event'
type ComposerState = { type: ComposerType; date: string; seq: number } | null

const noteTags: Array<{ value: NoteTag; label: string; color: string; bg: string }> = [
  { value: 'info', label: 'Info', color: '#60a5fa', bg: 'rgba(59,130,246,0.12)' },
  { value: 'importante', label: 'Importante', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  { value: 'urgente', label: 'Urgente', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
]

function CalendarNoteForm({ date, onClose }: { date: string; onClose: () => void }) {
  const { user } = useAuth()
  const { children, selectedChildId } = useAppStore()
  const child = useMemo(() => children.find(c => c.id === selectedChildId) ?? null, [children, selectedChildId])
  const [text, setText] = useState('')
  const [tag, setTag] = useState<NoteTag>('info')
  const [mentionOther, setMentionOther] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const canNotifyOther = !!child && child.parents.length >= 2
  const isValid = !!user && !!child && text.trim().length > 0

  const save = async () => {
    if (!user || !child || !isValid) return
    setLoading(true)
    setError('')
    try {
      await createNote({
        childId: child.id,
        createdBy: user.uid,
        createdByName: user.displayName ?? user.email ?? 'Progenitor',
        type: 'single',
        date,
        tag,
        text: text.trim(),
        mentionOther,
        read: false,
        documentIds: [],
      } as any)
      showToast({ message: 'Nota guardada.', tone: 'success' })
      onClose()
    } catch (e: any) {
      const message = e?.message || 'No se pudo guardar la nota'
      setError(message)
      showToast({ message, tone: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card" style={{ borderColor:'rgba(245,158,11,0.32)', borderRadius:24, background:'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-soft) 100%)', padding:16 }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, marginBottom:14 }}>
        <div>
          <div style={{ fontSize:14, fontWeight:900, color:'var(--text-strong)' }}>Nueva nota</div>
          <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:4 }}>{formatDate(date)}</div>
        </div>
        <div style={{ padding:'6px 10px', borderRadius:999, background:'rgba(245,158,11,0.12)', color:'#f59e0b', fontSize:11, fontWeight:850 }}>Calendario</div>
      </div>

      <div style={{ marginBottom:12 }}>
        <div className="settings-label">Etiqueta</div>
        <div style={{ display:'flex', gap:8 }}>
          {noteTags.map(option => (
            <button key={option.value} type="button" onClick={() => setTag(option.value)} style={{ flex:1, padding:'9px 4px', borderRadius:12, border:`1px solid ${tag === option.value ? option.color : 'var(--border)'}`, background:tag === option.value ? option.bg : 'var(--bg-soft)', color:option.color, fontSize:11, fontWeight:850, cursor:'pointer' }}>{option.label}</button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom:12 }}>
        <div className="settings-label">Nota</div>
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Escribe la nota para este día..." rows={4} className="settings-textarea" />
      </div>

      {canNotifyOther ? (
        <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', marginBottom:14 }}>
          <input type="checkbox" checked={mentionOther} onChange={e => setMentionOther(e.target.checked)} />
          <span style={{ fontSize:12, color:'var(--text-secondary)' }}>Notificar al otro progenitor</span>
        </label>
      ) : null}

      {error ? <div style={{ background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:10, padding:'8px 12px', marginBottom:10, fontSize:12, color:'#f87171' }}>{error}</div> : null}

      <div style={{ display:'flex', gap:8 }}>
        <button className="btn-primary btn-outline" style={{ flex:1 }} onClick={onClose}>Cancelar</button>
        <button style={{ flex:1, padding:11, borderRadius:12, border:'none', background:isValid && !loading ? '#f59e0b' : 'rgba(255,255,255,0.08)', color:isValid && !loading ? '#fff' : '#6b7280', fontSize:13, fontWeight:800, cursor:isValid && !loading ? 'pointer' : 'not-allowed' }} onClick={save} disabled={!isValid || loading}>{loading ? 'Guardando...' : 'Guardar nota'}</button>
      </div>
    </div>
  )
}

export function CalendarInlineComposerBridge() {
  const { setSelectedChildId, setSelectedCalendarDate, setCurrentMonth } = useAppStore()
  const [composer, setComposer] = useState<ComposerState>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<any>
      const detail = customEvent.detail
      const composerType = detail?.openComposer
      if ((composerType !== 'note' && composerType !== 'event') || !detail?.date) return

      event.preventDefault()
      event.stopImmediatePropagation()

      if (detail.childId) setSelectedChildId(detail.childId)
      setSelectedCalendarDate(detail.date)
      setCurrentMonth(new Date(detail.date + 'T12:00:00'))
      setComposer({ type: composerType, date: detail.date, seq: Date.now() })
    }

    window.addEventListener('custodia:navigate', handler, { capture: true })
    return () => window.removeEventListener('custodia:navigate', handler, { capture: true } as any)
  }, [setCurrentMonth, setSelectedCalendarDate, setSelectedChildId])

  if (!composer) return null

  return (
    <div style={{ position:'fixed', inset:0, zIndex:120, background:'rgba(0,0,0,0.52)', display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'74px 14px 18px' }} onClick={() => setComposer(null)}>
      <div style={{ width:'100%', maxWidth:560, maxHeight:'calc(100dvh - 92px)', overflow:'auto' }} onClick={event => event.stopPropagation()}>
        {composer.type === 'note' ? (
          <CalendarNoteForm key={composer.seq} date={composer.date} onClose={() => setComposer(null)} />
        ) : (
          <EventForm key={composer.seq} initialDate={composer.date} onClose={() => setComposer(null)} />
        )}
      </div>
    </div>
  )
}
