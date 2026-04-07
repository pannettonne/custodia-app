import { adminDb } from '@/lib/firebase-admin'
import type { NextRequest } from 'next/server'

function toISODate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function nextDay(date: Date) {
  const d = new Date(date)
  d.setDate(d.getDate() + 1)
  return d
}

function weekdayNumber(dateStr: string) {
  const js = new Date(dateStr + 'T12:00:00').getDay()
  return js === 0 ? 7 : js
}

function eventMatchesDate(event: any, dateStr: string) {
  const cancelled = Array.isArray(event.cancelledDates) && event.cancelledDates.includes(dateStr)
  if (cancelled) return false
  if (event.recurrence === 'weekly') {
    if (!event.date || !event.recurrenceUntil) return false
    if (dateStr < event.date || dateStr > event.recurrenceUntil) return false
    const weekdays = Array.isArray(event.recurrenceWeekdays) && event.recurrenceWeekdays.length > 0 ? event.recurrenceWeekdays : [weekdayNumber(event.date)]
    return weekdays.includes(weekdayNumber(dateStr))
  }
  if (event.recurrence === 'monthly') {
    if (!event.date || !event.recurrenceUntil) return false
    if (dateStr < event.date || dateStr > event.recurrenceUntil) return false
    return Number(dateStr.slice(8, 10)) === Number(String(event.date).slice(8, 10))
  }
  if (event.endDate) return dateStr >= event.date && dateStr <= event.endDate
  return event.date === dateStr
}

async function upsertNotification(key: string, payload: Record<string, any>) {
  await adminDb.collection('notifications').doc(key).set(payload, { merge: true })
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const today = new Date()
  const tomorrowStr = toISODate(nextDay(today))
  const todayStr = toISODate(today)

  const [childrenSnap, eventsSnap, requestsSnap, periodsSnap] = await Promise.all([
    adminDb.collection('children').get(),
    adminDb.collection('schoolEvents').get(),
    adminDb.collection('changeRequests').where('status', '==', 'pending').get(),
    adminDb.collection('specialPeriods').get(),
  ])

  const children = new Map(childrenSnap.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() }]))
  let created = 0

  for (const doc of eventsSnap.docs) {
    const event = { id: doc.id, ...doc.data() }
    if (!eventMatchesDate(event, tomorrowStr)) continue
    const child: any = children.get(event.childId)
    if (!child) continue
    for (const userId of child.parents || []) {
      const key = `event_${doc.id}_${tomorrowStr}_${userId}`
      await upsertNotification(key, {
        userId,
        childId: child.id,
        childName: child.name,
        type: 'event_reminder',
        title: `Recordatorio: ${event.title}`,
        body: `${child.name} tiene este evento mañana (${tomorrowStr}).`,
        dateKey: tomorrowStr,
        read: false,
        createdAt: new Date(),
      })
      created++
    }
  }

  for (const doc of requestsSnap.docs) {
    const req: any = doc.data()
    const key = `request_${doc.id}_${todayStr}_${req.toParentId}`
    await upsertNotification(key, {
      userId: req.toParentId,
      childId: req.childId,
      type: 'pending_request',
      title: 'Solicitud pendiente',
      body: `${req.fromParentName} te ha enviado una solicitud pendiente.`,
      dateKey: todayStr,
      read: false,
      createdAt: new Date(),
    })
    created++
  }

  for (const doc of periodsSnap.docs) {
    const period: any = { id: doc.id, ...doc.data() }
    if (period.startDate !== tomorrowStr) continue
    const child: any = children.get(period.childId)
    if (!child) continue
    const label = period.customLabel || period.label
    for (const userId of child.parents || []) {
      const key = `period_${doc.id}_${tomorrowStr}_${userId}`
      await upsertNotification(key, {
        userId,
        childId: child.id,
        childName: child.name,
        type: 'special_period_start',
        title: 'Empieza un período especial',
        body: `${child.name} empieza ${label} mañana.`,
        dateKey: tomorrowStr,
        read: false,
        createdAt: new Date(),
      })
      created++
    }
  }

  return Response.json({ ok: true, created })
}
