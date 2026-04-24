'use client'

import { useMemo } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { formatDate } from '@/lib/utils'
import { showToast } from '@/lib/toast'
import type { CollaboratorAssignment } from '@/types'

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

function toIcsDate(dateStr: string) {
  return dateStr.replace(/-/g, '')
}

function toIcsDateTime(dateStr: string, timeStr: string) {
  const [hours = '00', minutes = '00'] = timeStr.split(':')
  return `${toIcsDate(dateStr)}T${hours.padStart(2, '0')}${minutes.padStart(2, '0')}00`
}

function downloadAssignmentIcs(assignment: CollaboratorAssignment, childName: string) {
  if (typeof window === 'undefined') return

  const summary = assignment.type === 'partial_slot'
    ? `Asignación CustodiaApp · ${childName} · ${assignment.startTime || ''}-${assignment.endTime || ''}`
    : `Asignación CustodiaApp · ${childName} · Día completo`

  const descriptionParts = [
    `Asignación enviada por ${assignment.createdByParentName}.`,
    `Menor: ${childName}.`,
    assignment.notes ? `Observaciones: ${assignment.notes}` : '',
    assignment.locationName ? `Ubicación: ${assignment.locationName}` : '',
    assignment.locationAddress ? `Dirección: ${assignment.locationAddress}` : '',
  ].filter(Boolean)

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CustodiaApp//Asignaciones//ES',
    'BEGIN:VEVENT',
    `UID:collaborator-assignment-${assignment.id}@custodiaapp`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    `DESCRIPTION:${escapeIcsText(descriptionParts.join('\n'))}`,
  ]

  if (assignment.type === 'partial_slot' && assignment.startTime && assignment.endTime) {
    lines.push(`DTSTART:${toIcsDateTime(assignment.date, assignment.startTime)}`)
    lines.push(`DTEND:${toIcsDateTime(assignment.date, assignment.endTime)}`)
  } else {
    const endDate = new Date(`${assignment.date}T12:00:00`)
    endDate.setDate(endDate.getDate() + 1)
    lines.push(`DTSTART;VALUE=DATE:${toIcsDate(assignment.date)}`)
    lines.push(`DTEND;VALUE=DATE:${toIcsDate(endDate.toISOString().slice(0, 10))}`)
  }

  const location = [assignment.locationName, assignment.locationAddress].filter(Boolean).join(' · ')
  if (location) lines.push(`LOCATION:${escapeIcsText(location)}`)

  lines.push('END:VEVENT', 'END:VCALENDAR')

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `custodia-asignacion-${assignment.date}.ics`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
  showToast({ message: 'Calendario descargado.', tone: 'success' })
}

export function CollaboratorAssignmentCalendarPanel() {
  const { user } = useAuth()
  const { collaboratorAssignments, children, selectedChildId } = useAppStore()

  const child = useMemo(() => children.find(item => item.id === selectedChildId) ?? null, [children, selectedChildId])
  const assignments = useMemo(() => {
    if (!user?.uid) return []
    return collaboratorAssignments.filter(item => item.collaboratorId === user.uid && (item.status === 'pending' || item.status === 'accepted'))
  }, [collaboratorAssignments, user?.uid])

  if (!child || assignments.length === 0) return null

  return (
    <div className="card" style={{ marginTop: 12, padding: 14, borderRadius: 20, background:'linear-gradient(180deg, rgba(139,92,246,0.08) 0%, var(--bg-card) 100%)', border:'1px solid rgba(139,92,246,0.20)' }}>
      <div style={{ fontSize: 11, color: '#8B5CF6', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Calendario del móvil</div>
      <div style={{ fontSize: 14, color: 'var(--text-strong)', fontWeight: 800, marginBottom: 4 }}>Añadir asignaciones al calendario</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>Exporta tus asignaciones visibles como archivo .ics para abrirlo en el calendario del teléfono.</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {assignments.map((assignment) => (
          <div key={assignment.id} style={{ padding: '10px 12px', borderRadius: 16, border: '1px solid rgba(139,92,246,0.18)', background: 'var(--bg-card)' }}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8, marginBottom: 6 }}>
              <div style={{ fontSize: 13, color: 'var(--text-strong)', fontWeight: 800 }}>{assignment.createdByParentName}</div>
              <div style={{ fontSize: 11, color: assignment.status === 'accepted' ? '#10b981' : '#8B5CF6', fontWeight: 800 }}>{assignment.status === 'accepted' ? 'ACEPTADA' : 'PENDIENTE'}</div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>{formatDate(assignment.date)}{assignment.type === 'partial_slot' && assignment.startTime && assignment.endTime ? ` · ${assignment.startTime}-${assignment.endTime}` : ' · Día completo'}</div>
            <button className="req-action-btn" style={{ background:'rgba(139,92,246,0.12)', border:'1px solid rgba(139,92,246,0.24)', color:'#8B5CF6' }} onClick={() => downloadAssignmentIcs(assignment, child.name)}>Añadir al calendario</button>
          </div>
        ))}
      </div>
    </div>
  )
}
