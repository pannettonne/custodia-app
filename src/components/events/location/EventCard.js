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

export function EventCard({ event, onEdit }) {
  const { user } = useAuth()
  const { children, selectedChildId, pattern, overrides, specialPeriods, documents } = useAppStore()
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [deletionLoading, setDeletionLoading] = useState(false)
  const [openingDocId, setOpeningDocId] = useState(null)
  const child = useMemo(() => children.find(c => c.id === selectedChildId) ?? null, [children, selectedChildId])

  const cat = CAT_CONFIG[event.category]
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
    <div className="card" style={{ marginBottom: 10, opacity: isPast ? 0.7 : 1, border: `1px solid ${cat.color}33`, borderRadius: 22, padding: 16, background: `linear-gradient(180deg, ${cat.color}10 0%, var(--bg-card) 30%, var(--bg-soft) 100%)` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: `${cat.color}22`, border: `1px solid ${cat.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21, flexShrink: 0 }}>{cat.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--text-strong)', fontSize: 14, fontWeight: 800 }}>{event.title}</span>
            {isToday && <span style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981', fontSize: 10, fontWeight: 800, padding: '4px 8px', borderRadius: 999 }}>Hoy</span>}
            <span style={{ background: `${cat.color}22`, color: cat.color, fontSize: 10, fontWeight: 800, padding: '4px 8px', borderRadius: 999 }}>{categoryLabel}</span>
            {recurrenceLabel && <span style={{ background: 'rgba(139,92,246,0.18)', color: '#a78bfa', fontSize: 10, fontWeight: 800, padding: '4px 8px', borderRadius: 999 }}>{recurrenceLabel}</span>}
            {event.reminderEnabled && <span style={{ background: 'rgba(59,130,246,0.18)', color: '#93c5fd', fontSize: 10, fontWeight: 800, padding: '4px 8px', borderRadius: 999 }}>⏰ {event.reminderDaysBefore ?? 0}d</span>}
            {linkedDocuments.length > 0 && <span style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', fontSize: 10, fontWeight: 800, padding: '4px 8px', borderRadius: 999 }}>📎 {linkedDocuments.length} documento(s)</span>}
            {event.assignmentStatus === 'pending' && assignedName && <span style={{ background: 'rgba(59,130,246,0.18)', color: '#93c5fd', fontSize: 10, fontWeight: 800, padding: '4px 8px', borderRadius: 999 }}>Pendiente para {assignedName}</span>}
            {event.assignmentStatus === 'accepted' && assignedName && <span style={{ background: 'rgba(16,185,129,0.18)', color: '#6ee7b7', fontSize: 10, fontWeight: 800, padding: '4px 8px', borderRadius: 999 }}>Asignado a {assignedName}</span>}
            {event.deletionRequestStatus === 'pending' && <span style={{ background: 'rgba(245,158,11,0.16)', color: '#f59e0b', fontSize: 10, fontWeight: 800, padding: '4px 8px', borderRadius: 999 }}>Eliminación pendiente</span>}
          </div>

          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
            {formatDate(event.date)}{event.endDate ? ` → ${formatDate(event.endDate)}` : ''}{event.time ? ` · ${event.time}` : event.allDay ? ' · Todo el día' : ''}
          </div>

          <LocationActions event={event} navLinks={navLinks} />
          {event.notes && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, lineHeight: 1.5 }}>{event.notes}</div>}
          {linkedDocuments.length > 0 ? <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>{linkedDocuments.map(doc => <button key={doc.id} onClick={() => openDocument(doc)} disabled={openingDocId === doc.id} style={{ background:'var(--bg-soft)', border:'1px solid var(--border)', color:'var(--text-secondary)', fontSize:11, fontWeight:700, padding:'5px 8px', borderRadius:999, cursor:'pointer' }}>📎 {openingDocId === doc.id ? 'Abriendo...' : (doc.title || 'Documento')}</button>)}</div> : null}
          {event.reminderEnabled && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>Aviso: {event.reminderDaysBefore === 0 ? 'el mismo día' : `${event.reminderDaysBefore} día(s) antes`} · {event.reminderAudience === 'both' ? 'ambos progenitores' : 'solo tú'}</div>}
          {canManageEvent && event.createdBy !== user?.uid && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>Puedes gestionar este evento porque este día te corresponde según la custodia.</div>}
          {hasCustodyImpact && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>Este evento ya cambió la custodia. Esa parte queda bloqueada y su eliminación requiere aceptación del otro progenitor.</div>}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={addToCalendar} disabled={calendarLoading} style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.24)', borderRadius: 10, color: '#93c5fd', fontSize: 11, fontWeight: 800, padding: '7px 10px', cursor: 'pointer' }}>{calendarLoading ? 'Preparando...' : 'Añadir al calendario'}</button>
            {canManageEvent && <button onClick={onEdit} style={{ background: 'var(--bg-soft)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 11, fontWeight: 800, padding: '7px 10px', borderRadius: 10 }}>Editar</button>}
            {canManageEvent && !deletionPendingForMe && !canRespondDeletion && <button onClick={requestDelete} disabled={deletionLoading} style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.18)', color: '#fca5a5', cursor: 'pointer', fontSize: 11, fontWeight: 800, padding: '7px 10px', borderRadius: 10 }}>{deletionLoading ? 'Procesando...' : hasCustodyImpact ? 'Solicitar eliminación' : 'Eliminar'}</button>}
            {deletionPendingForMe && <span style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.20)', color: '#fbbf24', fontSize: 11, fontWeight: 800, padding: '7px 10px', borderRadius: 10 }}>Esperando aceptación</span>}
          </div>

          {child && canRequestAssignment && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>{child.parents.map(pid => <button key={pid} onClick={() => requestAssignment(pid)} style={{ background: 'var(--bg-soft)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-secondary)', fontSize: 11, fontWeight: 800, padding: '6px 9px', cursor: 'pointer' }}>Asignar a {child.parentNames?.[pid] ?? 'Progenitor'}</button>)}</div>}

          {canRespondAssignment && <div style={{ display: 'flex', gap: 8, marginTop: 8 }}><button onClick={() => respondAssignment(false)} style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, color: '#fca5a5', fontSize: 11, fontWeight: 800, padding: '7px 10px', cursor: 'pointer' }}>Rechazar</button><button onClick={() => respondAssignment(true)} style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 10, color: '#6ee7b7', fontSize: 11, fontWeight: 800, padding: '7px 10px', cursor: 'pointer' }}>Aceptar</button></div>}

          {canRespondDeletion && <div style={{ display: 'flex', gap: 8, marginTop: 8 }}><button onClick={() => respondDeletion(false)} disabled={deletionLoading} style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, color: '#fca5a5', fontSize: 11, fontWeight: 800, padding: '7px 10px', cursor: 'pointer' }}>Rechazar eliminación</button><button onClick={() => respondDeletion(true)} disabled={deletionLoading} style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 10, color: '#6ee7b7', fontSize: 11, fontWeight: 800, padding: '7px 10px', cursor: 'pointer' }}>Aceptar eliminación</button></div>}
        </div>
      </div>
    </div>
  )
}
