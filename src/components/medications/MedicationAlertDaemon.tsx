'use client'

import { useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { createNotification } from '@/lib/db'
import { getUpcomingMedicationOccurrences } from '@/lib/medications'

export function MedicationAlertDaemon() {
  const { user } = useAuth()
  const { selectedChildId, children, medications, medicationLogs } = useAppStore()

  useEffect(() => {
    if (!user?.uid || !selectedChildId) return

    const child = children.find(item => item.id === selectedChildId)
    if (!child) return

    const run = async () => {
      const today = new Date().toISOString().slice(0, 10)
      const occurrences = getUpcomingMedicationOccurrences(medications, medicationLogs, today, 2)
      const now = Date.now()

      for (const occurrence of occurrences) {
        if (!occurrence.reminderEnabled || occurrence.status === 'administered' || occurrence.status === 'skipped') continue
        const minutesBefore = occurrence.reminderMinutesBefore ?? 30
        const scheduledAt = new Date(occurrence.scheduledAt).getTime()
        const triggerAt = scheduledAt - (minutesBefore * 60 * 1000)
        if (now < triggerAt || now > scheduledAt + 15 * 60 * 1000) continue
        const storageKey = `custodia-medication-alert:${user.uid}:${occurrence.key}`
        if (typeof window !== 'undefined' && window.localStorage.getItem(storageKey)) continue

        await createNotification({
          userId: user.uid,
          childId: child.id,
          childName: child.name,
          type: 'medication_reminder',
          title: `Toma de ${occurrence.medicationName}`,
          body: `${child.name} · ${occurrence.scheduledTime} · ${occurrence.dosage} ${occurrence.dosageUnit || ''}`.trim(),
          dateKey: `medication-reminder:${occurrence.key}`,
          targetTab: 'medications',
          targetDate: occurrence.scheduledDate,
        })

        if (typeof window !== 'undefined') {
          window.localStorage.setItem(storageKey, String(Date.now()))
          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification(`Toma de ${occurrence.medicationName}`, {
                body: `${child.name} · ${occurrence.scheduledTime}`,
                tag: occurrence.key,
              })
            } catch {}
          }
        }
      }
    }

    void run()
    const interval = window.setInterval(() => { void run() }, 60000)
    return () => window.clearInterval(interval)
  }, [user?.uid, selectedChildId, children, medications, medicationLogs])

  return null
}
