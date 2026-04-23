import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminMessaging } from '@/lib/firebase-admin'

type AdminMedicationPlan = {
  id: string
  childId: string
  name: string
  dosage: string
  dosageUnit?: string
  intervalHours: number
  firstDoseTime: string
  startDate: string
  endDate: string
  status?: 'active' | 'paused' | 'completed'
  reminderEnabled?: boolean
  reminderMinutesBefore?: number
}

type AdminChild = {
  id: string
  name: string
  parents: string[]
  collaborators?: string[]
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

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function buildLocalDate(dateStr: string, timeStr = '08:00') {
  return new Date(`${dateStr}T${timeStr}:00`)
}

function toLocalIso(date: Date) {
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())
  return `${year}-${month}-${day}T${hours}:${minutes}:00`
}

function buildMedicationLogId(medicationId: string, scheduledAt: string) {
  return `${medicationId}__${scheduledAt.replace(/[^0-9A-Za-z]/g, '')}`
}

function buildLink(childId: string, targetDate: string) {
  const params = new URLSearchParams({ tab: 'medications', childId, date: targetDate })
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

async function reserveDispatchOnce(docId: string, payload: Record<string, unknown>) {
  const ref = adminDb.collection('medicationReminderDispatches').doc(docId)
  const existing = await ref.get()
  if (existing.exists) return false
  await ref.set({ ...payload, createdAt: new Date() })
  return true
}

async function createNotificationOnce({ docId, userId, childId, childName, title, body, dateKey, targetDate }: { docId: string; userId: string; childId: string; childName?: string; title: string; body: string; dateKey: string; targetDate: string }) {
  const ref = adminDb.collection('notifications').doc(docId)
  const existing = await ref.get()
  if (existing.exists) return false
  await ref.set({ userId, childId, childName: childName || null, type: 'medication_reminder', title, body, dateKey, read: false, createdAt: new Date(), targetTab: 'medications', targetDate })
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
        data: { childId: payload.childId, targetTab: 'medications', targetDate: payload.targetDate },
      },
      fcmOptions: { link },
    },
  })
  return { sent: res.successCount }
}

function getOccurrencesWithinWindow(plan: AdminMedicationPlan, windowStart: Date, windowEnd: Date) {
  if (!plan.startDate || !plan.endDate || !plan.firstDoseTime || !plan.intervalHours) return [] as Array<{ scheduledAt: string; scheduledDate: string; scheduledTime: string; remindAt: Date }>
  const everyMs = Math.max(1, plan.intervalHours) * 60 * 60 * 1000
  let cursor = buildLocalDate(plan.startDate, plan.firstDoseTime)
  const absoluteEnd = buildLocalDate(plan.endDate, '23:59')
  const items: Array<{ scheduledAt: string; scheduledDate: string; scheduledTime: string; remindAt: Date }> = []
  let iterations = 0
  while (cursor <= absoluteEnd && iterations < 2000) {
    const minutesBefore = Number(plan.reminderMinutesBefore ?? 30)
    const remindAt = new Date(cursor.getTime() - minutesBefore * 60 * 1000)
    if (remindAt >= windowStart && remindAt <= windowEnd) {
      const scheduledAt = toLocalIso(cursor)
      items.push({ scheduledAt, scheduledDate: scheduledAt.slice(0, 10), scheduledTime: scheduledAt.slice(11, 16), remindAt })
    }
    if (cursor > windowEnd && remindAt > windowEnd) break
    cursor = new Date(cursor.getTime() + everyMs)
    iterations += 1
  }
  return items
}

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorized(request)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const now = new Date()
    const windowStart = new Date(now.getTime() - 15 * 60 * 1000)
    const windowEnd = new Date(now.getTime() + 5 * 60 * 1000)
    const planSnap = await adminDb.collection('medications').where('reminderEnabled', '==', true).get()

    let processedPlans = 0
    let dueOccurrences = 0
    let created = 0
    let pushed = 0

    for (const doc of planSnap.docs) {
      const plan = { id: doc.id, ...doc.data() } as AdminMedicationPlan
      if (plan.status && plan.status !== 'active') continue
      processedPlans += 1

      const occurrences = getOccurrencesWithinWindow(plan, windowStart, windowEnd)
      if (occurrences.length === 0) continue

      const childSnap = await adminDb.collection('children').doc(plan.childId).get()
      if (!childSnap.exists) continue
      const child = { id: childSnap.id, ...childSnap.data() } as AdminChild
      const recipients = Array.from(new Set([...(child.parents || []), ...(child.collaborators || [])]))
      if (recipients.length === 0) continue

      for (const occurrence of occurrences) {
        const logId = buildMedicationLogId(plan.id, occurrence.scheduledAt)
        const logSnap = await adminDb.collection('medicationLogs').doc(logId).get()
        if (logSnap.exists) {
          const status = logSnap.get('status')
          if (status === 'administered' || status === 'skipped') continue
        }

        dueOccurrences += 1
        const title = `Toma de ${plan.name}`
        const body = `${child.name} · ${occurrence.scheduledTime} · ${plan.dosage}${plan.dosageUnit ? ` ${plan.dosageUnit}` : ''}`
        const usersToPush: string[] = []

        for (const uid of recipients) {
          const dispatchId = `medication-reminder__${plan.id}__${occurrence.scheduledAt.replace(/[^0-9A-Za-z]/g, '')}__${uid}`
          const reserved = await reserveDispatchOnce(dispatchId, {
            userId: uid,
            childId: child.id,
            medicationId: plan.id,
            scheduledAt: occurrence.scheduledAt,
          })
          if (!reserved) continue

          const channel = await getReminderChannel(uid)
          const dateKey = `medication-reminder:${plan.id}:${occurrence.scheduledAt}:${uid}`
          if (allowsInApp(channel)) {
            const createdNow = await createNotificationOnce({
              docId: dispatchId,
              userId: uid,
              childId: child.id,
              childName: child.name,
              title,
              body,
              dateKey,
              targetDate: occurrence.scheduledDate,
            })
            if (createdNow) created += 1
          }
          if (allowsPush(channel)) usersToPush.push(uid)
        }

        if (usersToPush.length > 0) {
          const pushRes = await sendPushToUsers(usersToPush, { title, body, childId: child.id, targetDate: occurrence.scheduledDate })
          pushed += pushRes.sent
        }
      }
    }

    return NextResponse.json({ ok: true, now: now.toISOString(), processedPlans, dueOccurrences, created, pushed })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error procesando recordatorios de medicación' }, { status: 500 })
  }
}
