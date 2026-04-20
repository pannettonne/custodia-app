'use client'
import { createNotification } from '@/lib/db'
import type { SchoolEvent, EventCategory } from '@/types'

export type LocationSuggestion = {
  placeId: string
  name: string
  address: string
  latitude: number
  longitude: number
}

export const CAT_CONFIG: Record<EventCategory, { label: string; icon: string; color: string }> = {
  reunion: { label: 'Reunión', icon: '👥', color: '#3b82f6' },
  excursion: { label: 'Excursión', icon: '🚌', color: '#10b981' },
  examen: { label: 'Examen', icon: '📝', color: '#f59e0b' },
  extraescolar: { label: 'Extraescolar', icon: '⚽', color: '#8b5cf6' },
  festivo: { label: 'Festivo', icon: '🎉', color: '#ec4899' },
  vacaciones: { label: 'Vacaciones', icon: '🏖️', color: '#06b6d4' },
  otro: { label: 'Personalizada', icon: '📌', color: '#6b7280' },
}

export const WEEKDAYS = [
  { value: 1, label: 'L' },
  { value: 2, label: 'M' },
  { value: 3, label: 'X' },
  { value: 4, label: 'J' },
  { value: 5, label: 'V' },
  { value: 6, label: 'S' },
  { value: 7, label: 'D' },
]

export const ICS_WEEKDAY_MAP: Record<number, string> = {
  1: 'MO',
  2: 'TU',
  3: 'WE',
  4: 'TH',
  5: 'FR',
  6: 'SA',
  7: 'SU',
}

export function buildMonthlyDate(baseDate: string, dayOfMonth: number): string {
  if (!baseDate) return ''
  const [year, month] = baseDate.split('-')
  const safeDay = String(Math.max(1, Math.min(31, dayOfMonth))).padStart(2, '0')
  return `${year}-${month}-${safeDay}`
}

export function listDates(startDate: string, endDate?: string) {
  const result: string[] = []
  const start = new Date(`${startDate}T12:00:00`)
  const end = new Date(`${endDate || startDate}T12:00:00`)
  let cur = new Date(start)

  while (cur <= end) {
    result.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }

  return result
}

export function pad(value: number) {
  return String(value).padStart(2, '0')
}

export function formatICSDateUTC(date: Date) {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
}

export function formatICSDateOnly(dateStr: string) {
  return dateStr.replaceAll('-', '')
}

export function escapeICS(value?: string) {
  return (value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

export function buildEventDateRange(event: SchoolEvent) {
  if (event.allDay) {
    const start = formatICSDateOnly(event.date)
    const endBase = new Date(`${event.endDate || event.date}T12:00:00`)
    endBase.setDate(endBase.getDate() + 1)
    const end = `${endBase.getFullYear()}${pad(endBase.getMonth() + 1)}${pad(endBase.getDate())}`
    return [`DTSTART;VALUE=DATE:${start}`, `DTEND;VALUE=DATE:${end}`]
  }

  const [hours, minutes] = (event.time || '09:00').split(':').map(Number)
  const start = new Date(`${event.date}T${pad(hours || 0)}:${pad(minutes || 0)}:00`)
  const end = new Date(start)
  end.setHours(end.getHours() + 1)

  return [`DTSTART:${formatICSDateUTC(start)}`, `DTEND:${formatICSDateUTC(end)}`]
}

export function buildRecurrenceRule(event: SchoolEvent) {
  if (event.recurrence === 'weekly' && event.recurrenceUntil) {
    const byDay =
      (event.recurrenceWeekdays || [])
        .map(day => ICS_WEEKDAY_MAP[day])
        .filter(Boolean)
        .join(',') || ICS_WEEKDAY_MAP[new Date(`${event.date}T12:00:00`).getDay() || 7]

    const until = new Date(`${event.recurrenceUntil}T23:59:59Z`)
    return `RRULE:FREQ=WEEKLY;BYDAY=${byDay};UNTIL=${formatICSDateUTC(until)}`
  }

  if (event.recurrence === 'monthly' && event.recurrenceUntil) {
    const day = Number(event.date.slice(8, 10)) || 1
    const until = new Date(`${event.recurrenceUntil}T23:59:59Z`)
    return `RRULE:FREQ=MONTHLY;BYMONTHDAY=${day};UNTIL=${formatICSDateUTC(until)}`
  }

  return ''
}

export function buildICS(event: SchoolEvent) {
  const stamp = formatICSDateUTC(new Date())
  const uid = `${event.id || `${event.title}-${event.date}`.replace(/\s+/g, '-')}-custodiaapp`
  const dateLines = buildEventDateRange(event)
  const recurrence = buildRecurrenceRule(event)
  const alarms = event.reminderEnabled
    ? [
        'BEGIN:VALARM',
        `TRIGGER:-P${Math.max(0, event.reminderDaysBefore || 0)}D`,
        'ACTION:DISPLAY',
        `DESCRIPTION:${escapeICS(event.title)}`,
        'END:VALARM',
      ]
    : []
  const location = event.locationAddress || event.locationName

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CustodiaApp//ES',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `SUMMARY:${escapeICS(event.title)}`,
    ...dateLines,
    `DESCRIPTION:${escapeICS(event.notes || '')}`,
    location ? `LOCATION:${escapeICS(location)}` : '',
    recurrence,
    ...alarms,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n')
}

export async function downloadICSFile(event: SchoolEvent) {
  const filename =
    `${(event.title || 'evento').toLowerCase().replace(/[^a-z0-9]+/gi, '-') || 'evento'}.ics`
  const file = new File([buildICS(event)], filename, { type: 'text/calendar;charset=utf-8' })
  const nav = navigator as Navigator & {
    share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>
    canShare?: (data: { files?: File[] }) => boolean
  }

  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: event.title, text: 'Añadir al calendario' })
      return
    } catch {}
  }

  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function buildNavigationLinks(event: SchoolEvent) {
  const hasCoords =
    typeof event.locationLatitude === 'number' && typeof event.locationLongitude === 'number'

  const encodedDestination = encodeURIComponent(event.locationAddress || event.locationName || '')

  return {
    googleMaps: hasCoords
      ? `https://www.google.com/maps/search/?api=1&query=${event.locationLatitude},${event.locationLongitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodedDestination}`,
    waze: hasCoords
      ? `https://waze.com/ul?ll=${event.locationLatitude},${event.locationLongitude}&navigate=yes`
      : `https://waze.com/ul?q=${encodedDestination}&navigate=yes`,
    appleMaps: hasCoords
      ? `https://maps.apple.com/?ll=${event.locationLatitude},${event.locationLongitude}`
      : `https://maps.apple.com/?q=${encodedDestination}`,
  }
}

export async function notifyEventAssignmentPending(params: {
  toUserId: string
  childId: string
  childName?: string
  eventTitle: string
  dateKey: string
  requesterName: string
}) {
  await createNotification({
    userId: params.toUserId,
    childId: params.childId,
    childName: params.childName,
    type: 'event_assignment_pending',
    title: 'Asignación de evento pendiente',
    body: `${params.requesterName} te ha pedido asignarte el evento ${params.eventTitle}.`,
    dateKey: params.dateKey,
  })
}

export async function notifyEventAssignmentResponse(params: {
  toUserId: string
  childId: string
  childName?: string
  eventTitle: string
  dateKey: string
  accepted: boolean
  responderName: string
}) {
  await createNotification({
    userId: params.toUserId,
    childId: params.childId,
    childName: params.childName,
    type: 'event_assignment_response',
    title: params.accepted ? 'Asignación de evento aceptada' : 'Asignación de evento rechazada',
    body: `${params.responderName} ha ${params.accepted ? 'aceptado' : 'rechazado'} la asignación del evento ${params.eventTitle}.`,
    dateKey: params.dateKey,
  })
}
