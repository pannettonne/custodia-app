'use client'
import { useMemo, useState } from 'react'
import { collection, deleteDoc, getDocs, query, where } from 'firebase/firestore'
import { useAuth } from '@/lib/auth-context'
import { db } from '@/lib/firebase'
import { createNotification, deleteEvent, setOverride, updateEvent } from '@/lib/db'
import { getParentForDate, formatDate } from '@/lib/utils'
import { useAppStore } from '@/store/app'
import { decryptDocumentToFile } from '@/lib/document-crypto'
import {
  CAT_CONFIG,
  buildNavigationLinks,
  downloadICSFile,
  listDates,
  notifyEventAssignmentPending,
  notifyEventAssignmentResponse,
} from './shared'
import { LocationActions } from './LocationActions'

async function clearEventCustodyOverrides(event) {
  const dates = listDates(event.date, event.endDate)
  const reason = event.custodyOverrideReason || `Asignación por evento: ${event.title}`

  for (const date of dates) {
    const snap = await getDocs(query(collection(db, 'custodyOverrides'), where('childId', '==', event.childId), where('date', '==', date)))
    await Promise.all(
      snap.docs
        .filter(docSnap => (docSnap.data()?.reason || '') === reason)
        .map(docSnap => deleteDoc(docSnap.ref))
    )
  }
}

function formatEventTime(event) {
  if (event.allDay) return 'Todo el día'
  if (event.time && event.endTime) return `${event.time}-${event.endTime}`
  if (event.time) return event.time
  if (event.endTime) return `Hasta ${event.endTime}`
  return 'Sin hora'
}

function compactNote(note) {
  if (!note) return ''
  const normalized = note.replace(/\s+/g, ' ').trim()
  return normalized.length > 110 ? `${normalized.slice(0, 107)}...` : normalized
}

function compactActionButton({ title, icon, onClick, disabled = false, tone = 'neutral' }) {
  const palette = tone === 'blue'
    ? { background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.24)', color: '#93c5fd' }
    : { background: 'var(--bg-soft)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      style={{
        width: 34,
        height: 34,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 10,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 16,
        fontWeight: 800,
        opacity: disabled ? 0.72 : 1,
        ...palette,
      }}
    >
      {icon}
    </button>
  )
}

export function EventCard({ event, onEdit }) {
  const { user } = useAuth()
  const { children, selectedChildId, pattern, overrides, specialPeriods, documents } = useAppStore()
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [deletionLoading, setDeletionLoading] = useState(false)
  const [openingDocId, setOpeningDocId] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const child = useMemo(() => children.find(c => c.id === selectedChildId) ?? null, [children, selectedChildId])

  const cat = CAT_CONFIG[event.category] || CAT_CONFIG.otro
  const today = new Date().toISOString().slice(0, 10)
  const isPast = event.date < today
  const isToday = event.date === today
  const categoryLabel = event.category === 'otro' ? event.customCategory || cat.label : cat.label
  const recurrenceLabel = event.recurrence === 'weekly' ? 'Semanal' : event.recurrence === 'monthly' ? 'Mensual' : ''
  const assignedName = event.assignedParentId && child ? child.parentNames?.[event.assignedParentId] : null
  const canRespondAssignment = event.assignmentStatus === 'pending' && user?.uid === event.assignmentRequestToParentId
  const effectiveOwnerId = useMemo(() => {
    if (!child || !pattern) return null
    return getParentForDate(new Date(`${event.date}T12:00:00`), pattern, overrides, child, specialPeriods)
  }, [child, event.date, overrides, pattern, specialPeriods])
  const canManageEvent = !!user?.uid && (event.createdBy === user.uid || effectiveOwnerId === user.uid)
  const canRequestAssignment = !!child && child.parents.length >= 2 && canManageEvent && event.assignmentStatus !== 'pending' && event.assignmentStatus !== 'accepted'
  const navLinks = buildNavigationLinks(event)
  const hasCustodyImpact = event.assignmentStatus === 'accepted' && !!event.assignedParentId
  const otherParentId = child?.parents.find(pid => pid !== user?.uid) ?? null
  const deletionPendingForMe = event.deletionRequestStatus === 'pending' && event.deletionRequestedBy === user?.uid
  const canRespondDeletion = event.deletionRequestStatus === 'pending' && user?.uid === event.deletionRequestToParentId
  const linkedDocuments = (event.documentIds || []).map(id => documents.find(doc => doc.id === id)).filter(Boolean)
  const summaryChips = [
    recurrenceLabel ? { text: recurrenceLabel, tone: 'rgba(139,92,246,0.18)', color: '#a78bfa' } : null,
    event.reminderEnabled ? { text: `⏰ ${event.reminderDaysBefore ?? 0}d`, tone: 'rgba(59,130,246,0.18)', color: '#93c5fd' } : null,
    linkedDocuments.length > 0 ? { text: `📎 ${linkedDocuments.length}`, tone: 'rgba(16,185,129,0.15)', color: '#10b981' } : null,
  ].filter(Boolean)
  const compactedNote = compactNote(event.notes)
  const canShowMenu = (canManageEvent && !deletionPendingForMe && !canRespondDeletion) || canRequestAssignment

  const openDocument = async doc => {
    if (!user?.uid) return
    setOpeningDocId(doc.id)
    try {
      const idToken = await user.getIdToken()
      const decrypted = await decryptDocumentToFile(doc, user.uid, idToken)
      const url = URL.createObjectURL(decrypted.blob)
      const anchor = window.document.createElement('a')
      anchor.href = url
      anchor.download = decrypted.filename
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Event document open failed', error)
    } finally {
      setOpeningDocId(null)
    }
  }

  const requestAssignment = async targetParentId => {
    if (!user || !child) return
    const otherParent = child.parents.find(pid => pid !== user.uid)
    if (!otherParent) return
    await updateEvent(event.id, {
      assignedParentId: targetParentId,
      assignmentStatus: 'pending',
      assignmentRequestedBy: user.uid,
      assignmentRequestedByName: user.displayName || user.email || 'Progenitor',
      assignmentRequestToParentId: otherParent,
    })
    await notifyEventAssignmentPending({
      toUserId: otherParent,
      childId: event.childId,
      childName: child.name,
      eventTitle: event.title,
      dateKey: event.date,
      requesterName: user.displayName || user.email || 'Progenitor',
    })
    setMenuOpen(false)
  }

  const respondAssignment = async accept => {
    if (!user || !child) return
    if (!accept) {
      await updateEvent(event.id, { assignmentStatus: 'rejected' })
      if (event.assignmentRequestedBy) {
        await notifyEventAssignmentResponse({
          toUserId: event.assignmentRequestedBy,
          childId: event.childId,
          childName: child.name,
          eventTitle: event.title,
          dateKey: event.date,
          accepted: false,
          responderName: user.displayName || user.email || 'Progenitor',
        })
      }
      return
    }

    const custodyOverrideReason = `Asignación por evento: ${event.title}`
    await updateEvent(event.id, { assignmentStatus: 'accepted', custodyOverrideReason })
    if (event.allDay && event.assignedParentId) {
      for (const date of listDates(event.date, event.endDate)) {
        await setOverride({ childId: event.childId, date, parentId: event.assignedParentId, reason: custodyOverrideReason, createdBy: user.uid })
      }
    }
    if (event.assignmentRequestedBy) {
      await notifyEventAssignmentResponse({
        toUserId: event.assignmentRequestedBy,
        childId: event.childId,
        childName: child.name,
        eventTitle: event.title,
        dateKey: event.date,
        accepted: true,
        responderName: user.displayName || user.email || 'Progenitor',
      })
    }
  }

  const addToCalendar = async () => {
    setCalendarLoading(true)
    try { await downloadICSFile(event) } finally { setCalendarLoading(false) }
  }

  const performDelete = async () => {
    if (hasCustodyImpact && event.allDay) {
      await clearEventCustodyOverrides(event)
    }
    await deleteEvent(event.id)
  }

  const requestDelete = async () => {
    if (!user || !child || !canManageEvent) return
    setDeletionLoading(true)
    try {
      if (hasCustodyImpact && otherParentId) {
        const requesterName = user.displayName || user.email || 'Progenitor'
        await updateEvent(event.id, {
          deletionRequestStatus: 'pending',
          deletionRequestedBy: user.uid,
          deletionRequestedByName: requesterName,
          deletionRequestToParentId: otherParentId,
        })
        await createNotification({
          userId: otherParentId,
          childId: event.childId,
          childName: child.name,
          type: 'event_assignment_pending',
          title: 'Eliminación de evento pendiente',
          body: `${requesterName} quiere eliminar el evento ${event.title}.`,
          dateKey: event.date,
          targetTab: 'events',
          targetDate: event.date,
        })
        return
      }
      await performDelete()
    } finally {
      setDeletionLoading(false)
      setMenuOpen(false)
    }
  }

  const respondDeletion = async accept => {
    if (!user || !child || !canRespondDeletion) return
    setDeletionLoading(true)
    try {
      if (!accept) {
        await updateEvent(event.id, { deletionRequestStatus: 'rejected' })
        if (event.deletionRequestedBy) {
          await createNotification({
            userId: event.deletionRequestedBy,
            childId: event.childId,
            childName: child.name,
            type: 'event_assignment_response',
            title: 'Eliminación de evento rechazada',
            body: `${user.displayName || user.email || 'Progenitor'} ha rechazado eliminar el evento ${event.title}.`,
            dateKey: event.date,
            targetTab: 'events',
            targetDate: event.date,
          })
        }
        return
      }

      if (event.deletionRequestedBy) {
        await createNotification({
          userId: event.deletionRequestedBy,
          childId: event.childId,
          childName: child.name,
          type: 'event_assignment_response',
          title: 'Eliminación de evento aceptada',
          body: `${user.displayName || user.email || 'Progenitor'} ha aceptado eliminar el evento ${event.title}.`,
          dateKey: event.date,
          targetTab: 'events',
          targetDate: event.date,
        })
      }
      await performDelete()
    } finally {
      setDeletionLoading(false)
    }
  }

  return (
    <div className="card" style={{ marginBottom: 10, opacity: isPast ? 0.72 : 1, border: `1px solid ${cat.color}28`, borderRadius: 22, padding: 14, background: `linear-gradient(180deg, ${cat.color}0F 0%, var(--bg-card) 45%, var(--bg-soft) 100%)` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 14, background: `${cat.color}22`, border: `1px solid ${cat.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, flexShrink: 0 }}>{cat.icon}</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                <span style={{ color: 'var(--text-strong)', fontSize: 14, fontWeight: 800 }}>{event.title}</span>
                {isToday && <span style={{ background: 'rgba(16,185,129,0.18)', color: '#10b981', fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 999 }}>Hoy</span>}
                <span style={{ background: `${cat.color}20`, color: cat.color, fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 999 }}>{categoryLabel}</span>
                {event.assignmentStatus === 'pending' && assignedName && <span style={{ background: 'rgba(59,130,246,0.18)', color: '#93c5fd', fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 999 }}>Pendiente</span>}
                {event.assignmentStatus === 'accepted' && assignedName && <span style={{ background: 'rgba(16,185,129,0.18)', color: '#6ee7b7', fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 999 }}>Asignado</span>}
                {event.deletionRequestStatus === 'pending' && <span style={{ background: 'rgba(245,158,11,0.16)', color: '#f59e0b', fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 999 }}>Eliminación pendiente</span>}
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700 }}>
                {formatDate(event.date)}{event.endDate ? ` → ${formatDate(event.endDate)}` : ''} · {formatEventTime(event)}
              </div>
            </div>

            {summaryChips.length > 0 ? (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 0 }}>
                {summaryChips.map(chip => (
                  <span key={chip.text} style={{ background: chip.tone, color: chip.color, fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 999 }}>{chip.text}</span>
                ))}
              </div>
            ) : null}
          </div>

          {(event.locationName || event.locationAddress) ? <LocationActions event={event} navLinks={navLinks} /> : null}
          {compactedNote ? <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45, marginTop: 6 }}>{compactedNote}</div> : null}
          {linkedDocuments.length > 0 ? <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:8 }}>{linkedDocuments.map(doc => <button key={doc.id} onClick={() => openDocument(doc)} disabled={openingDocId === doc.id} style={{ background:'var(--bg-soft)', border:'1px solid var(--border)', color:'var(--text-secondary)', fontSize:10, fontWeight:700, padding:'4px 8px', borderRadius:999, cursor:'pointer' }}>📎 {openingDocId === doc.id ? 'Abriendo...' : (doc.title || 'Documento')}</button>)}</div> : null}
          {event.reminderEnabled && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8 }}>Aviso {event.reminderDaysBefore === 0 ? 'el mismo día' : `${event.reminderDaysBefore} día(s) antes`} · {event.reminderAudience === 'both' ? 'ambos progenitores' : 'solo tú'}</div>}
          {canManageEvent && event.createdBy !== user?.uid && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8 }}>Puedes gestionarlo porque este día te corresponde según la custodia.</div>}
          {hasCustodyImpact && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8 }}>Ya afectó a la custodia y su eliminación requiere aceptación.</div>}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            {compactActionButton({ title: calendarLoading ? 'Preparando calendario' : 'Añadir al calendario', icon: calendarLoading ? '…' : '📅', onClick: addToCalendar, disabled: calendarLoading, tone: 'blue' })}
            {canManageEvent ? compactActionButton({ title: 'Editar evento', icon: '✏️', onClick: onEdit }) : null}

            {canShowMenu && (
              <div style={{ position: 'relative' }}>
                <button onClick={() => setMenuOpen(v => !v)} title="Más acciones" aria-label="Más acciones" style={{ background: 'var(--bg-soft)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 16, fontWeight: 800, padding: '4px 10px', borderRadius: 10 }}>⋯</button>
                {menuOpen && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, minWidth: 190, padding: 8, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--bg-card)', boxShadow: '0 14px 30px rgba(15,23,42,0.16)', zIndex: 60, display: 'grid', gap: 6 }}>
                    {canRequestAssignment && child?.parents.map(pid => (
                      <button key={pid} onClick={() => requestAssignment(pid)} style={{ textAlign: 'left', background: 'transparent', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: 12, fontWeight: 800, padding: '8px 10px', borderRadius: 10 }}>
                        Asignar a {child.parentNames?.[pid] ?? 'Progenitor'}
                      </button>
                    ))}
                    {canManageEvent && !deletionPendingForMe && !canRespondDeletion && (
                      <button onClick={requestDelete} disabled={deletionLoading} style={{ textAlign: 'left', background: 'transparent', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: 12, fontWeight: 800, padding: '8px 10px', borderRadius: 10 }}>
                        {deletionLoading ? 'Procesando...' : hasCustodyImpact ? 'Solicitar eliminación' : 'Eliminar'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {deletionPendingForMe && <span style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.20)', color: '#fbbf24', fontSize: 11, fontWeight: 800, padding: '7px 10px', borderRadius: 10 }}>Esperando aceptación</span>}
          </div>

          {canRespondAssignment && <div style={{ display: 'flex', gap: 8, marginTop: 10 }}><button onClick={() => respondAssignment(false)} style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, color: '#fca5a5', fontSize: 11, fontWeight: 800, padding: '7px 10px', cursor: 'pointer' }}>Rechazar</button><button onClick={() => respondAssignment(true)} style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 10, color: '#6ee7b7', fontSize: 11, fontWeight: 800, padding: '7px 10px', cursor: 'pointer' }}>Aceptar</button></div>}

          {canRespondDeletion && <div style={{ display: 'flex', gap: 8, marginTop: 10 }}><button onClick={() => respondDeletion(false)} disabled={deletionLoading} style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, color: '#fca5a5', fontSize: 11, fontWeight: 800, padding: '7px 10px', cursor: 'pointer' }}>Rechazar eliminación</button><button onClick={() => respondDeletion(true)} disabled={deletionLoading} style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 10, color: '#6ee7b7', fontSize: 11, fontWeight: 800, padding: '7px 10px', cursor: 'pointer' }}>Aceptar eliminación</button></div>}
        </div>
      </div>
    </div>
  )
}
