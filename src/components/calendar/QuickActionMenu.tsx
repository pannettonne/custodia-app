'use client'
import { useState, useRef, useEffect } from 'react'
import { toISODate } from '@/lib/utils'
import { createEvent, createNote } from '@/lib/db'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import type { EventCategory, NoteTag } from '@/types'

interface QuickActionMenuProps {
  date: string
  x: number
  y: number
  onClose: () => void
}

export function QuickActionMenu({ date, x, y, onClose }: QuickActionMenuProps) {
  const { user } = useAuth()
  const { selectedChildId, children, refreshEvents, refreshNotes } = useAppStore()
  const [showEventForm, setShowEventForm] = useState(false)
  const [showNoteForm, setShowNoteForm] = useState(false)
  const [eventTitle, setEventTitle] = useState('')
  const [eventCategory, setEventCategory] = useState<EventCategory>('escolar' as EventCategory)
  const [eventAllDay, setEventAllDay] = useState(true)
  const [eventTime, setEventTime] = useState('')
  const [noteText, setNoteText] = useState('')
  const [noteTag, setNoteTag] = useState<NoteTag>('importante' as NoteTag)
  const [loading, setLoading] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  const child = children.find(c => c.id === selectedChildId)
  if (!child || !user) return null

  const handleCreateEvent = async () => {
    if (!eventTitle.trim()) return
    setLoading(true)
    try {
      await createEvent({
        childId: child.id,
        title: eventTitle.trim(),
        category: eventCategory,
        date,
        endDate: date,
        allDay: eventAllDay,
        time: eventAllDay ? undefined : eventTime || undefined,
        recurrence: 'none',
        createdBy: user.uid,
      })
      refreshEvents()
      onClose()
    } catch (err) {
      console.error('Error creando evento:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateNote = async () => {
    if (!noteText.trim()) return
    setLoading(true)
    try {
      await createNote({
        childId: child.id,
        text: noteText.trim(),
        tag: noteTag,
        type: 'single',
        date,
        createdBy: user.uid,
        createdByName: user.displayName || 'Usuario',
        read: false,
        mentionOther: false,
      })
      refreshNotes()
      onClose()
    } catch (err) {
      console.error('Error creando nota:', err)
    } finally {
      setLoading(false)
    }
  }

  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(x, window.innerWidth - 280),
    top: Math.min(y, window.innerHeight - 400),
    zIndex: 9999,
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
    padding: 16,
    minWidth: 260,
  }

  if (showEventForm) {
    return (
      <div ref={menuRef} style={menuStyle}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-strong)', marginBottom: 12 }}>
          Nuevo evento - {date}
        </div>
        <input
          type="text"
          placeholder="Título del evento"
          value={eventTitle}
          onChange={(e) => setEventTitle(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-soft)', fontSize: 13, marginBottom: 10 }}
          autoFocus
        />
        <select
          value={eventCategory}
          onChange={(e) => setEventCategory(e.target.value as EventCategory)}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-soft)', fontSize: 13, marginBottom: 10 }}
        >
          <option value="escolar">📚 Escolar</option>
          <option value="extrasescolar">🎨 Extraescolar</option>
          <option value="medico">🏥 Médico</option>
          <option value="ocio">🎉 Ocio</option>
          <option value="otro">⚙️ Otro</option>
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Todo el día</label>
          <input
            type="checkbox"
            checked={eventAllDay}
            onChange={(e) => setEventAllDay(e.target.checked)}
          />
        </div>
        {!eventAllDay && (
          <input
            type="time"
            value={eventTime}
            onChange={(e) => setEventTime(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-soft)', fontSize: 13, marginBottom: 10 }}
          />
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowEventForm(false)}
            style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-soft)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            Cancelar
          </button>
          <button
            onClick={handleCreateEvent}
            disabled={loading || !eventTitle.trim()}
            style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: '#10b981', color: '#fff', fontSize: 12, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? '...' : 'Crear'}
          </button>
        </div>
      </div>
    )
  }

  if (showNoteForm) {
    return (
      <div ref={menuRef} style={menuStyle}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-strong)', marginBottom: 12 }}>
          Nueva nota - {date}
        </div>
        <textarea
          placeholder="Escribe tu nota..."
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          rows={4}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-soft)', fontSize: 13, resize: 'vertical', marginBottom: 10 }}
          autoFocus
        />
        <select
          value={noteTag}
          onChange={(e) => setNoteTag(e.target.value as NoteTag)}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-soft)', fontSize: 13, marginBottom: 10 }}
        >
          <option value="importante">⭐ Importante</option>
          <option value="recordatorio">📌 Recordatorio</option>
          <option value="informacion">ℹ️ Información</option>
          <option value="otro">⚙️ Otro</option>
        </select>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowNoteForm(false)}
            style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-soft)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            Cancelar
          </button>
          <button
            onClick={handleCreateNote}
            disabled={loading || !noteText.trim()}
            style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: '#f59e0b', color: '#fff', fontSize: 12, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? '...' : 'Crear'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div ref={menuRef} style={menuStyle}>
      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-strong)', marginBottom: 12 }}>
        Acciones rápidas - {date}
      </div>
      <button
        onClick={() => setShowEventForm(true)}
        style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: 'rgba(16,185,129,0.1)', color: '#10b981', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 8, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10 }}
      >
        <span style={{ fontSize: 18 }}>📅</span>
        Crear evento
      </button>
      <button
        onClick={() => setShowNoteForm(true)}
        style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: 'rgba(245,158,11,0.1)', color: '#f59e0b', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 8, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10 }}
      >
        <span style={{ fontSize: 18 }}>📝</span>
        Crear nota
      </button>
      <button
        onClick={onClose}
        style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-soft)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
      >
        Cancelar
      </button>
    </div>
  )
}
