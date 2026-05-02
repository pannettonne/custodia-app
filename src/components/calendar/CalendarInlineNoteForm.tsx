'use client'

import { useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { createNote } from '@/lib/db'
import { showToast } from '@/lib/toast'
import { formatDate } from '@/lib/utils'
import type { NoteTag } from '@/types'

export function CalendarInlineNoteForm({ date, onClose }: { date: string; onClose: () => void }) {
  const { user } = useAuth()
  const { children, selectedChildId } = useAppStore()
  const child = useMemo(() => children.find(item => item.id === selectedChildId) ?? null, [children, selectedChildId])
  const [text, setText] = useState('')
  const [tag, setTag] = useState<NoteTag>('info')
  const [mentionOther, setMentionOther] = useState(false)
  const [loading, setLoading] = useState(false)
  const canSave = !!user && !!child && text.trim().length > 0

  const save = async () => {
    if (!user || !child || !canSave) return
    setLoading(true)
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
    } catch (error: any) {
      showToast({ message: error?.message || 'No se pudo guardar la nota.', tone: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card" style={{ padding: 16, borderRadius: 24, borderColor: 'rgba(245,158,11,0.32)', background: 'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-soft) 100%)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ color: 'var(--text-strong)', fontSize: 14, fontWeight: 900 }}>Nueva nota</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>{formatDate(date)}</div>
        </div>
        <div style={{ padding: '6px 10px', borderRadius: 999, background: 'rgba(245,158,11,0.12)', color: '#f59e0b', fontSize: 11, fontWeight: 850 }}>Calendario</div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div className="settings-label">Etiqueta</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['info', 'importante', 'urgente'] as NoteTag[]).map(value => (
            <button key={value} type="button" onClick={() => setTag(value)} style={{ flex: 1, padding: '9px 4px', borderRadius: 12, border: `1px solid ${tag === value ? '#f59e0b' : 'var(--border)'}`, background: tag === value ? 'rgba(245,158,11,0.12)' : 'var(--bg-soft)', color: tag === value ? '#f59e0b' : 'var(--text-secondary)', fontSize: 11, fontWeight: 850, cursor: 'pointer', textTransform: 'capitalize' }}>{value}</button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div className="settings-label">Nota</div>
        <textarea value={text} onChange={event => setText(event.target.value)} placeholder="Escribe la nota para este día..." rows={4} className="settings-textarea" />
      </div>

      {child && child.parents.length >= 2 ? (
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 14 }}>
          <input type="checkbox" checked={mentionOther} onChange={event => setMentionOther(event.target.checked)} />
          <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Notificar al otro progenitor</span>
        </label>
      ) : null}

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn-primary btn-outline" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
        <button style={{ flex: 1, padding: 11, borderRadius: 12, border: 'none', background: canSave && !loading ? '#f59e0b' : 'rgba(255,255,255,0.08)', color: canSave && !loading ? '#fff' : '#6b7280', fontSize: 13, fontWeight: 800, cursor: canSave && !loading ? 'pointer' : 'not-allowed' }} onClick={save} disabled={!canSave || loading}>{loading ? 'Guardando...' : 'Guardar nota'}</button>
      </div>
    </div>
  )
}
