'use client'
import { useState, useMemo } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { createNote, deleteNote, markNoteRead } from '@/lib/db'
import { formatDate } from '@/lib/utils'
import type { Note, NoteTag } from '@/types'

const TAG_CONFIG: Record<NoteTag, { label: string; color: string; bg: string }> = {
  info:       { label: 'Info',       color: '#60a5fa', bg: 'rgba(59,130,246,0.12)'  },
  importante: { label: 'Importante', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  urgente:    { label: 'Urgente',    color: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
}

export function NotesPanel() {
  const { user } = useAuth()
  const { notes, children, selectedChildId } = useAppStore()
  const [showForm, setShowForm] = useState(false)
  const child = useMemo(() => children.find(c => c.id === selectedChildId) ?? null, [children, selectedChildId])
  const unread = useMemo(() => notes.filter(n => !n.read && n.createdBy !== user?.uid).length, [notes, user?.uid])

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div className="page-title" style={{ marginBottom:0 }}>Notas</div>
          {unread > 0 && <span style={{ background:'#ef4444', color:'#fff', fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20 }}>{unread} nueva{unread>1?'s':''}</span>}
        </div>
        <button onClick={() => setShowForm(true)} style={{ background:'#3B82F6', border:'none', borderRadius:12, padding:'8px 14px', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>+ Nueva nota</button>
      </div>
      {showForm && <NoteForm onClose={() => setShowForm(false)} />}
      {notes.length === 0 && !showForm
        ? <div className="empty-state"><div className="empty-state-icon">📝</div><div className="empty-state-title">Sin notas todavía</div><div className="empty-state-sub">Añade notas sobre días concretos para el otro progenitor</div></div>
        : <div>{notes.map(note => <NoteCard key={note.id} note={note} child={child} />)}</div>
      }
    </div>
  )
}

function NoteCard({ note, child }: { note: Note; child: any }) {
  const { user } = useAuth()
  const tag = TAG_CONFIG[note.tag]
  const isOwn = note.createdBy === user?.uid
  const dateText = note.type === 'single' ? formatDate(note.date!) : `${formatDate(note.startDate!)} → ${formatDate(note.endDate!)}`
  const authorColor = child?.parentColors?.[note.createdBy] ?? '#6b7280'
  return (
    <div className="card" style={{ borderLeft:`3px solid ${tag.color}`, borderRadius:'0 16px 16px 0', marginBottom:10 }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8, marginBottom:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <span style={{ background:tag.bg, color:tag.color, fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:6 }}>{tag.label}</span>
          {note.mentionOther && <span style={{ background:'rgba(139,92,246,0.15)', color:'#a78bfa', fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:6 }}>@ Mencionado</span>}
          {!note.read && !isOwn && <span style={{ background:'rgba(239,68,68,0.15)', color:'#f87171', fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:6 }}>● Nueva</span>}
        </div>
        {isOwn && <button onClick={() => deleteNote(note.id)} style={{ background:'none', border:'none', color:'#6b7280', cursor:'pointer', fontSize:16, lineHeight:1, padding:'0 2px' }}>✕</button>}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
        <div style={{ width:8, height:8, borderRadius:'50%', background:authorColor, flexShrink:0 }} />
        <span style={{ fontSize:11, color:'#9ca3af' }}>{note.createdByName} · 📅 {dateText}</span>
      </div>
      <p style={{ color:'#e5e7eb', fontSize:13, lineHeight:1.6 }}>{note.text}</p>
    </div>
  )
}

function NoteForm({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  const { children, selectedChildId } = useAppStore()
  const child = useMemo(() => children.find(c => c.id === selectedChildId) ?? null, [children, selectedChildId])

  const [type, setType] = useState<'single'|'range'>('single')
  const [date, setDate] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [text, setText] = useState('')
  const [tag, setTag] = useState<NoteTag>('info')
  const [mentionOther, setMentionOther] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isValid = text.trim().length > 0 && (type === 'single' ? !!date : !!startDate && !!endDate)

  const handleSubmit = async () => {
    if (!user || !child) { setError('Sin usuario o menor'); return }
    if (!isValid) { setError('Rellena todos los campos'); return }
    setLoading(true)
    setError('')
    try {
      await createNote({
        childId: child.id,
        createdBy: user.uid,
        createdByName: user.displayName ?? user.email ?? 'Progenitor',
        type, tag, text: text.trim(), mentionOther, read: false,
        ...(type === 'single' ? { date } : { startDate, endDate }),
      })
      onClose()
    } catch(e: any) {
      setError(e?.message ?? 'Error guardando')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card" style={{ marginBottom:16, borderColor:'rgba(59,130,246,0.3)' }}>
      <div style={{ fontSize:13, fontWeight:700, color:'#9ca3af', marginBottom:12 }}>📝 Nueva nota</div>

      <div style={{ marginBottom:10 }}>
        <div className="settings-label">Tipo</div>
        <div className="type-toggle">
          {[{v:'single',l:'📅 Día concreto'},{v:'range',l:'↔ Rango'}].map(({v,l}) => (
            <button key={v} className={`type-btn ${type===v?'active':''}`} onClick={() => setType(v as any)}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom:10 }}>
        <div className="settings-label">{type==='single'?'Fecha':'Período'}</div>
        {type==='single'
          ? <input type="date" value={date} onChange={e => setDate(e.target.value)} className="settings-input" />
          : <div className="date-pair">
              <div><div className="date-pair-label">Desde</div><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="settings-input" /></div>
              <div><div className="date-pair-label">Hasta</div><input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} className="settings-input" /></div>
            </div>
        }
      </div>

      <div style={{ marginBottom:10 }}>
        <div className="settings-label">Etiqueta</div>
        <div style={{ display:'flex', gap:8 }}>
          {(Object.entries(TAG_CONFIG) as [NoteTag, typeof TAG_CONFIG[NoteTag]][]).map(([k,v]) => (
            <button key={k} onClick={() => setTag(k)}
              style={{ flex:1, padding:'8px 4px', borderRadius:10, border:`1px solid ${tag===k?v.color:'rgba(255,255,255,0.1)'}`, background:tag===k?v.bg:'rgba(255,255,255,0.04)', color:v.color, fontSize:11, fontWeight:700, cursor:'pointer' }}>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom:10 }}>
        <div className="settings-label">Nota</div>
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Escribe tu nota aquí..." rows={3} className="settings-textarea" />
      </div>

      {child && child.parents.length >= 2 && (
        <div style={{ marginBottom:14 }}>
          <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
            <div onClick={() => setMentionOther(!mentionOther)}
              style={{ width:20, height:20, borderRadius:6, border:`2px solid ${mentionOther?'#8b5cf6':'rgba(255,255,255,0.2)'}`, background:mentionOther?'#8b5cf6':'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, cursor:'pointer' }}>
              {mentionOther && <span style={{ color:'#fff', fontSize:12, fontWeight:700 }}>✓</span>}
            </div>
            <span style={{ fontSize:12, color:'#9ca3af' }}>
              Notificar a <strong style={{ color:'#a78bfa' }}>{child.parentNames?.[child.parents.find((p: string) => p!==user?.uid)??'']??'el otro progenitor'}</strong>
            </span>
          </label>
        </div>
      )}

      {error && <div style={{ background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:10, padding:'8px 12px', marginBottom:10, fontSize:12, color:'#f87171' }}>⚠️ {error}</div>}

      <div style={{ display:'flex', gap:8 }}>
        <button style={{ flex:1, padding:11, borderRadius:12, border:'1px solid rgba(255,255,255,0.2)', background:'transparent', color:'#9ca3af', fontSize:13, fontWeight:700, cursor:'pointer' }} onClick={onClose}>Cancelar</button>
        <button
          style={{ flex:1, padding:11, borderRadius:12, border:'none', background: loading ? '#1d4ed8' : '#3B82F6', color:'#fff', fontSize:13, fontWeight:700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? 'Guardando...' : 'Guardar nota'}
        </button>
      </div>
    </div>
  )
}
