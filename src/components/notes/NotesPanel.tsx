'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { createNote, deleteNote, markNoteRead, updateNote } from '@/lib/db'
import { formatDate } from '@/lib/utils'
import type { Note, NoteTag } from '@/types'

const TAG_CONFIG: Record<NoteTag, { label: string; color: string; bg: string }> = {
  info:       { label: 'Info',       color: '#60a5fa', bg: 'rgba(59,130,246,0.12)'  },
  importante: { label: 'Importante', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  urgente:    { label: 'Urgente',    color: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
}

export function NotesPanel({ focusTargetId, focusSeq, initialCreateDate, createSeq }: { focusTargetId?: string; focusSeq?: number; initialCreateDate?: string; createSeq?: number } = {}) {
  const { user } = useAuth()
  const { notes, children, selectedChildId } = useAppStore()
  const [showForm, setShowForm] = useState(false)
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const child = useMemo(() => children.find(c => c.id === selectedChildId) ?? null, [children, selectedChildId])
  const unread = useMemo(() => notes.filter(n => !n.read && n.createdBy !== user?.uid).length, [notes, user?.uid])

  useEffect(() => {
    if (!focusTargetId || !focusTargetId.startsWith('note-')) return
    const target = cardRefs.current[focusTargetId]
    if (!target) return
    const timer = window.setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setHighlightedId(focusTargetId)
    }, 80)
    const clearTimer = window.setTimeout(() => setHighlightedId(current => current === focusTargetId ? null : current), 2600)
    return () => {
      window.clearTimeout(timer)
      window.clearTimeout(clearTimer)
    }
  }, [focusTargetId, focusSeq, notes.length])

  useEffect(() => {
    if (!initialCreateDate || !createSeq) return
    setEditingNote(null)
    setShowForm(true)
  }, [initialCreateDate, createSeq])

  return (
    <div>
      <div className="card" style={{ marginBottom:16, padding:16, borderRadius:20, background:'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-soft) 100%)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
          <div>
            <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:800, textTransform:'uppercase', letterSpacing:0.4, marginBottom:4 }}>Comunicación</div>
            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
              <div className="page-title" style={{ marginBottom:0 }}>Notas</div>
              {unread > 0 && <span style={{ background:'rgba(239,68,68,0.16)', color:'#f87171', fontSize:11, fontWeight:800, padding:'4px 10px', borderRadius:999 }}>{unread} nueva{unread>1?'s':''}</span>}
            </div>
            <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:4 }}>Notas rápidas entre progenitores para días concretos o rangos.</div>
          </div>
          <button onClick={() => { setEditingNote(null); setShowForm(true) }} style={{ background:'#3B82F6', border:'none', borderRadius:12, padding:'10px 14px', color:'#fff', fontSize:12, fontWeight:800, cursor:'pointer', boxShadow:'0 10px 24px rgba(59,130,246,0.22)' }}>+ Nueva nota</button>
        </div>
      </div>

      {showForm && <NoteForm note={editingNote} onClose={() => { setShowForm(false); setEditingNote(null) }} initialDate={initialCreateDate} />}
      {notes.length === 0 && !showForm
        ? <div className="empty-state"><div className="empty-state-icon">📝</div><div className="empty-state-title">Sin notas todavía</div><div className="empty-state-sub">Añade notas sobre días concretos para el otro progenitor</div></div>
        : <div style={{ display:'grid', gap:10 }}>
            {notes.map(note => {
              const searchId = `note-${note.id}`
              return (
                <div
                  key={note.id}
                  ref={el => { cardRefs.current[searchId] = el }}
                  style={highlightedId === searchId ? { borderRadius: 22, boxShadow: '0 0 0 2px rgba(59,130,246,0.45), 0 18px 40px rgba(59,130,246,0.16)', transition: 'box-shadow 0.2s ease' } : undefined}
                >
                  <NoteCard note={note} child={child} onEdit={() => { setEditingNote(note); setShowForm(true) }} />
                </div>
              )
            })}
          </div>
      }
    </div>
  )
}

function NoteCard({ note, child, onEdit }: { note: Note; child: any; onEdit: () => void }) {
  const { user } = useAuth()
  const tag = TAG_CONFIG[note.tag]
  const isOwn = note.createdBy === user?.uid
  const dateText = note.type === 'single' ? formatDate(note.date!) : `${formatDate(note.startDate!)} → ${formatDate(note.endDate!)}`
  const authorColor = child?.parentColors?.[note.createdBy] ?? '#6b7280'
  return (
    <div className="card" style={{ border:`1px solid ${tag.color}33`, borderRadius:20, marginBottom:0, padding:16, background:'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-soft) 100%)' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8, marginBottom:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <span style={{ background:tag.bg, color:tag.color, fontSize:10, fontWeight:800, padding:'4px 9px', borderRadius:999 }}>{tag.label}</span>
          {note.mentionOther && <span style={{ background:'rgba(139,92,246,0.15)', color:'#a78bfa', fontSize:10, fontWeight:800, padding:'4px 9px', borderRadius:999 }}>Mencionado</span>}
          {!note.read && !isOwn && <span style={{ background:'rgba(239,68,68,0.15)', color:'#f87171', fontSize:10, fontWeight:800, padding:'4px 9px', borderRadius:999 }}>Nueva</span>}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', justifyContent:'flex-end' }}>
          {!isOwn && !note.read && <button onClick={() => markNoteRead(note.id)} style={{ background:'rgba(59,130,246,0.12)', border:'1px solid rgba(59,130,246,0.22)', color:'#93c5fd', cursor:'pointer', fontSize:11, fontWeight:800, padding:'6px 10px', borderRadius:10 }}>Marcar leída</button>}
          {isOwn && <button onClick={onEdit} style={{ background:'var(--bg-soft)', border:'1px solid var(--border)', color:'var(--text-secondary)', cursor:'pointer', fontSize:11, fontWeight:800, padding:'6px 10px', borderRadius:10 }}>Editar</button>}
          {isOwn && <button onClick={() => deleteNote(note.id)} style={{ background:'rgba(239,68,68,0.10)', border:'1px solid rgba(239,68,68,0.18)', color:'#fca5a5', cursor:'pointer', fontSize:11, fontWeight:800, padding:'6px 10px', borderRadius:10 }}>Eliminar</button>}
        </div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
        <div style={{ width:8, height:8, borderRadius:'50%', background:authorColor, flexShrink:0 }} />
        <span style={{ fontSize:11, color:'var(--text-secondary)' }}>{note.createdByName} · {dateText}</span>
      </div>
      <p style={{ color:'var(--text-strong)', fontSize:13, lineHeight:1.6, margin:0 }}>{note.text}</p>
    </div>
  )
}

function NoteForm({ note, onClose, initialDate }: { note: Note | null; onClose: () => void; initialDate?: string }) {
  const { user } = useAuth()
  const { children, selectedChildId } = useAppStore()
  const child = useMemo(() => children.find(c => c.id === selectedChildId) ?? null, [children, selectedChildId])

  const [type, setType] = useState<'single'|'range'>(note?.type ?? 'single')
  const [date, setDate] = useState(note?.date ?? initialDate ?? '')
  const [startDate, setStartDate] = useState(note?.startDate ?? '')
  const [endDate, setEndDate] = useState(note?.endDate ?? '')
  const [text, setText] = useState(note?.text ?? '')
  const [tag, setTag] = useState<NoteTag>(note?.tag ?? 'info')
  const [mentionOther, setMentionOther] = useState(note?.mentionOther ?? false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isValid = text.trim().length > 0 && (type === 'single' ? !!date : !!startDate && !!endDate && startDate <= endDate)

  const handleSubmit = async () => {
    if (!user || !child) { setError('Sin usuario o menor'); return }
    if (!isValid) { setError('Rellena todos los campos'); return }
    setLoading(true); setError('')
    try {
      const payload = {
        childId: child.id,
        createdBy: note?.createdBy ?? user.uid,
        createdByName: note?.createdByName ?? user.displayName ?? user.email ?? 'Progenitor',
        type, tag, text: text.trim(), mentionOther, read: note?.read ?? false,
        ...(type === 'single' ? { date, startDate: undefined, endDate: undefined } : { startDate, endDate, date: undefined }),
      }
      if (note) await updateNote(note.id, payload)
      else await createNote(payload as any)
      onClose()
    } catch(e: any) {
      setError(e?.message ?? 'Error guardando')
    } finally { setLoading(false) }
  }

  return (
    <div className="card" style={{ marginBottom:16, borderColor:'rgba(59,130,246,0.3)', borderRadius:20, background:'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-soft) 100%)' }}>
      <div style={{ fontSize:13, fontWeight:800, color:'var(--text-secondary)', marginBottom:12 }}>{note ? 'Editar nota' : 'Nueva nota'}</div>
      <div style={{ marginBottom:10 }}>
        <div className="settings-label">Tipo</div>
        <div className="type-toggle">
          {[{v:'single',l:'Día concreto'},{v:'range',l:'Rango'}].map(({v,l}) => (
            <button key={v} className={`type-btn ${type===v?'active':''}`} onClick={() => setType(v as any)}>{l}</button>
          ))}
        </div>
      </div>
      <div style={{ marginBottom:10 }}>
        <div className="settings-label">{type==='single'?'Fecha':'Período'}</div>
        {type==='single'
          ? <input type="date" value={date} onChange={e => setDate(e.target.value)} className="settings-input" />
          : <div className="date-pair"><div><div className="date-pair-label">Desde</div><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="settings-input" /></div><div><div className="date-pair-label">Hasta</div><input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} className="settings-input" /></div></div>}
      </div>
      <div style={{ marginBottom:10 }}>
        <div className="settings-label">Etiqueta</div>
        <div style={{ display:'flex', gap:8 }}>
          {(Object.entries(TAG_CONFIG) as [NoteTag, typeof TAG_CONFIG[NoteTag]][]).map(([k,v]) => (
            <button key={k} onClick={() => setTag(k)} style={{ flex:1, padding:'9px 4px', borderRadius:12, border:`1px solid ${tag===k?v.color:'var(--border)'}`, background:tag===k?v.bg:'var(--bg-soft)', color:v.color, fontSize:11, fontWeight:800, cursor:'pointer' }}>{v.label}</button>
          ))}
        </div>
      </div>
      <div style={{ marginBottom:10 }}><div className="settings-label">Nota</div><textarea value={text} onChange={e => setText(e.target.value)} placeholder="Escribe tu nota aquí..." rows={3} className="settings-textarea" /></div>
      {child && child.parents.length >= 2 && (
        <div style={{ marginBottom:14 }}>
          <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
            <input type="checkbox" checked={mentionOther} onChange={e => setMentionOther(e.target.checked)} />
            <span style={{ fontSize:12, color:'var(--text-secondary)' }}>Notificar al otro progenitor</span>
          </label>
        </div>
      )}
      {error && <div style={{ background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:10, padding:'8px 12px', marginBottom:10, fontSize:12, color:'#f87171' }}>{error}</div>}
      <div style={{ display:'flex', gap:8 }}>
        <button style={{ flex:1, padding:11, borderRadius:12, border:'1px solid var(--border)', background:'var(--bg-soft)', color:'var(--text-secondary)', fontSize:13, fontWeight:800, cursor:'pointer' }} onClick={onClose}>Cancelar</button>
        <button style={{ flex:1, padding:11, borderRadius:12, border:'none', background: loading ? '#1d4ed8' : '#3B82F6', color:'#fff', fontSize:13, fontWeight:800, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }} onClick={handleSubmit} disabled={loading}>{loading ? 'Guardando...' : (note ? 'Guardar cambios' : 'Guardar nota')}</button>
      </div>
    </div>
  )
}
