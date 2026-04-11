import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminMessaging } from '@/lib/firebase-admin'

type AdminEvent = {
  id: string
  childId: string
  createdBy: string
  title: string
  date: string
  endDate?: string
  recurrence?: 'none' | 'weekly' | 'monthly'
  recurrenceUntil?: string
  recurrenceWeekdays?: number[]
  reminderEnabled?: boolean
  reminderDaysBefore?: number
  reminderAudience?: 'self' | 'both'
}

type AdminChild = {
  id: string
  name: string
  parents: string[]
}

type NotificationChannel = 'off' | 'in_app' | 'push' | 'both'

type UserNotificationSettings = {
  reminders?: NotificationChannel
}

function isAuthorized(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || ''
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  return !!process.env.CRON_SECRET && bearer === process.env.CRON_SECRET
}

function addDays(dateStr: string, delta: number) {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + delta)
  return d.toISOString().slice(0, 10)
}

function weekdayFromDate(dateStr: string) {
  const jsDay = new Date(dateStr + 'T12:00:00').getDay()
  return jsDay === 0 ? 7 : jsDay
}

function buildMonthlyOccurrence(baseDate: string, year: number, monthIndex: number) {
  const day = Number(baseDate.slice(8, 10))
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  if (day > daysInMonth) return null
  const month = String(monthIndex + 1).padStart(2, '0')
  const safeDay = String(day).padStart(2, '0')
  return `${year}-${month}-${safeDay}`
}

function matchesReminderToday(event: AdminEvent, today: string) {
  if (!event.reminderEnabled) return { match: false, occurrenceDate: null as string | null }
  const daysBefore = Number(event.reminderDaysBefore ?? 0)
  const occurrenceTarget = addDays(today, daysBefore)

  if (!event.recurrence || event.recurrence === 'none') return { match: event.date === occurrenceTarget, occurrenceDate: event.date }
  if (!event.recurrenceUntil) return { match: false, occurrenceDate: null }
  if (occurrenceTarget < event.date || occurrenceTarget > event.recurrenceUntil) return { match: false, occurrenceDate: null }

  if (event.recurrence === 'weekly') {
    const weekdays = Array.isArray(event.recurrenceWeekdays) && event.recurrenceWeekdays.length > 0 ? event.recurrenceWeekdays : [weekdayFromDate(event.date)]
    return { match: weekdays.includes(weekdayFromDate(occurrenceTarget)), occurrenceDate: occurrenceTarget }
  }

  if (event.recurrence === 'monthly') {
    const dt = new Date(occurrenceTarget + 'T12:00:00')
    const occurrenceDate = buildMonthlyOccurrence(event.date, dt.getFullYear(), dt.getMonth())
    if (!occurrenceDate) return { match: false, occurrenceDate: null }
    if (occurrenceDate < event.date || occurrenceDate > event.recurrenceUntil) return { match: false, occurrenceDate: null }
    return { match: occurrenceDate === occurrenceTarget, occurrenceDate }
  }

  return { match: false, occurrenceDate: null }
}

function buildLink(childId: string, targetDate: string) {
  const params = new URLSearchParams({ tab: 'events', childId, date: targetDate })
  return `/?${params.toString()}`
}

function allowsInApp(channel: NotificationChannel) {
  return channel === 'in_app' || channel === 'both'
}
function allowsPush(channel: NotificationChannel) {
  return channel === 'push' || channel === 'both'
}

async function getReminderChannel(uid: string): Promise<NotificationChannel> {
  const snap = await adminDb.collection('userNotificationSettings').doc(uid).get()
  if (!snap.exists) return 'both'
  const data = snap.data() as UserNotificationSettings
  return data.reminders || 'both'
}

async function createNotificationOnce({ docId, userId, childId, childName, title, body, dateKey, targetDate }: { docId: string; userId: string; childId: string; childName?: string; title: string; body: string; dateKey: string; targetDate: string }) {
  const ref = adminDb.collection('notifications').doc(docId)
  const existing = await ref.get()
  if (existing.exists) return false
  await ref.set({ userId, childId, childName: childName || null, type: 'event_reminder', title, body, dateKey, read: false, createdAt: new Date(), targetTab: 'events', targetDate })
  return true
}

async function sendPushToUsers(userIds: string[], payload: { title: string; body: string; childId: string; targetDate: string }) {
  if (userIds.length === 0) return { sent: 0 }
  const snaps = await Promise.all(userIds.map(uid => adminDb.collection('pushSubscriptions').where('uid', '==', uid).get()))
  const tokens = snaps.flatMap(s => s.docs.map(d => d.get('token')).filter(Boolean))
  if (tokens.length === 0) return { sent: 0 }
  const link = buildLink(payload.childId, payload.targetDate)
  const res = await adminMessaging.sendEachForMulticast({
    tokens,
    notification: { title: payload.title, body: payload.body },
    webpush: {
      notification: {
        title: payload.title,
        body: payload.body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        data: { childId: payload.childId, targetTab: 'events', targetDate: payload.targetDate },
      },
      fcmOptions: { link },
    },
  })
  return { sent: res.successCount }
}

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorized(request)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const today = new Date().toISOString().slice(0, 10)
    const eventSnap = await adminDb.collection('schoolEvents').where('reminderEnabled', '==', true).get()
    let processed = 0
    let created = 0
    let pushed = 0

    for (const doc of eventSnap.docs) {
      const event = { id: doc.id, ...doc.data() } as AdminEvent
      const check = matchesReminderToday(event, today)
      if (!check.match || !check.occurrenceDate) continue
      processed += 1

      const childSnap = await adminDb.collection('children').doc(event.childId).get()
      if (!childSnap.exists) continue
      const child = { id: childSnap.id, ...childSnap.data() } as AdminChild
      const recipients = event.reminderAudience === 'both' ? child.parents : [event.createdBy]
      const title = 'Recordatorio de evento'
      const body = `${event.title} ${Number(event.reminderDaysBefore ?? 0) === 0 ? 'es hoy' : `es en ${event.reminderDaysBefore} día(s)`}.`

      const usersToPush: string[] = []
      for (const uid of recipients) {
        const channel = await getReminderChannel(uid)
        const docId = `event-reminder__${event.id}__${check.occurrenceDate}__${uid}`
        const dateKey = `event-reminder:${event.id}:${check.occurrenceDate}:${uid}`
        if (allowsInApp(channel)) {
          const wasCreated = await createNotificationOnce({ docId, userId: uid, childId: child.id, childName: child.name, title, body, dateKey, targetDate: check.occurrenceDate })
          if (wasCreated) created += 1
        }
        if (allowsPush(channel)) usersToPush.push(uid)
      }
      if (usersToPush.length > 0) {
        const pushRes = await sendPushToUsers(usersToPush, { title, body, childId: child.id, targetDate: check.occurrenceDate })
        pushed += pushRes.sent
      }
    }

    return NextResponse.json({ ok: true, today, processed, created, pushed })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error procesando recordatorios' }, { status: 500 })
  }
}
