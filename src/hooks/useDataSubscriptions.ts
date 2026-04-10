'use client'
import { useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import {
  subscribeToChildren, subscribeToPattern, subscribeToOverrides,
  subscribeToRequests, subscribeToInvitations, subscribeToNotes,
  subscribeToEvents, subscribeToPackingItems, subscribeToSpecialPeriods,
  subscribeToNotifications, createNotification,
} from '@/lib/db'

function computeReminderTargets(event: any): string[] {
  if (!event?.reminderEnabled) return []
  if (!event?.date) return []
  const daysBefore = Number(event.reminderDaysBefore ?? 0)
  const makeTarget = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00')
    d.setDate(d.getDate() - daysBefore)
    return d.toISOString().slice(0, 10)
  }

  if (event.recurrence === 'weekly' || event.recurrence === 'monthly') {
    return [makeTarget(event.date)]
  }

  return [makeTarget(event.date)]
}

export function useDataSubscriptions() {
  const { user } = useAuth()
  const {
    selectedChildId, children, events, notifications,
    setChildren, setPattern, setOverrides, setRequests,
    setInvitations, setNotes, setEvents, setPackingItems, setSpecialPeriods,
    setSelectedChildId, setNotifications,
  } = useAppStore()

  useEffect(() => {
    if (!user) return
    return subscribeToChildren(user.uid, kids => {
      setChildren(kids)
      if (kids.length > 0 && !selectedChildId) setSelectedChildId(kids[0].id)
    })
  }, [user?.uid])

  useEffect(() => {
    if (!user?.email) return
    return subscribeToInvitations(user.email, setInvitations)
  }, [user?.email])

  useEffect(() => {
    if (!user?.uid) return
    return subscribeToNotifications(user.uid, setNotifications)
  }, [user?.uid])

  useEffect(() => {
    if (!selectedChildId) {
      setPattern(null); setOverrides([]); setRequests([])
      setNotes([]); setEvents([]); setPackingItems([]); setSpecialPeriods([])
      return
    }
    const u1 = subscribeToPattern(selectedChildId, setPattern)
    const u2 = subscribeToOverrides(selectedChildId, setOverrides)
    const u3 = subscribeToRequests(selectedChildId, setRequests)
    const u4 = subscribeToNotes(selectedChildId, setNotes)
    const u5 = subscribeToEvents(selectedChildId, setEvents)
    const u6 = subscribeToPackingItems(selectedChildId, setPackingItems)
    const u7 = subscribeToSpecialPeriods(selectedChildId, setSpecialPeriods)
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7() }
  }, [selectedChildId])

  useEffect(() => {
    if (!user?.uid || !selectedChildId) return
    const child = children.find(c => c.id === selectedChildId)
    if (!child) return
    const today = new Date().toISOString().slice(0, 10)

    const run = async () => {
      for (const event of events) {
        if (!event.reminderEnabled) continue
        const targetDates = computeReminderTargets(event)
        if (!targetDates.includes(today)) continue

        const recipients = event.reminderAudience === 'both'
          ? child.parents
          : [user.uid]

        for (const uid of recipients) {
          if (event.reminderAudience === 'self' && uid !== user.uid) continue
          const dateKey = `event-reminder:${event.id}:${today}:${uid}`
          const exists = notifications.some(n => n.type === 'event_reminder' && n.dateKey === dateKey)
          if (exists) continue
          await createNotification({
            userId: uid,
            childId: child.id,
            childName: child.name,
            type: 'event_reminder',
            title: 'Recordatorio de evento',
            body: `${event.title} ${event.allDay ? 'es' : 'empieza'} ${event.reminderDaysBefore ? `en ${event.reminderDaysBefore} día(s)` : 'hoy'}.`,
            dateKey,
          })
        }
      }
    }

    void run()
  }, [user?.uid, selectedChildId, children, events, notifications])
}
