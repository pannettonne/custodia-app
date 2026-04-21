import type { MedicationLog, MedicationPlan } from '@/types'

export type MedicationOccurrenceStatus = 'pending' | 'due_soon' | 'overdue' | 'administered' | 'skipped'

export interface MedicationOccurrence {
  key: string
  medicationId: string
  medicationName: string
  childId: string
  scheduledAt: string
  scheduledDate: string
  scheduledTime: string
  dosage: string
  dosageUnit?: string
  route?: string
  instructions?: string
  observations?: string
  reminderEnabled?: boolean
  reminderMinutesBefore?: number
  status: MedicationOccurrenceStatus
  log?: MedicationLog
  plan: MedicationPlan
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

export function buildLocalDate(dateStr: string, timeStr = '08:00') {
  return new Date(`${dateStr}T${timeStr}:00`)
}

export function toLocalIso(date: Date) {
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())
  return `${year}-${month}-${day}T${hours}:${minutes}:00`
}

export function buildMedicationLogId(medicationId: string, scheduledAt: string) {
  return `${medicationId}__${scheduledAt.replace(/[^0-9A-Za-z]/g, '')}`
}

function getOccurrenceStatus(scheduledAt: Date, log?: MedicationLog): MedicationOccurrenceStatus {
  if (log?.status === 'administered') return 'administered'
  if (log?.status === 'skipped') return 'skipped'
  const now = new Date()
  const diffMs = scheduledAt.getTime() - now.getTime()
  if (diffMs <= 0) return 'overdue'
  if (diffMs <= 60 * 60 * 1000) return 'due_soon'
  return 'pending'
}

export function getMedicationOccurrencesInRange(
  plans: MedicationPlan[],
  logs: MedicationLog[],
  startDate: string,
  endDate: string,
) {
  const rangeStart = buildLocalDate(startDate, '00:00')
  const rangeEnd = buildLocalDate(endDate, '23:59')
  const logMap = new Map(logs.map(log => [buildMedicationLogId(log.medicationId, log.scheduledAt), log]))
  const items: MedicationOccurrence[] = []

  for (const plan of plans) {
    if (plan.status && plan.status !== 'active') continue
    if (!plan.startDate || !plan.endDate || !plan.firstDoseTime || !plan.intervalHours) continue
    const everyMs = Math.max(1, plan.intervalHours) * 60 * 60 * 1000
    let cursor = buildLocalDate(plan.startDate, plan.firstDoseTime)
    const absoluteEnd = buildLocalDate(plan.endDate, '23:59')
    let iterations = 0

    while (cursor <= absoluteEnd && iterations < 1200) {
      if (cursor >= rangeStart && cursor <= rangeEnd) {
        const scheduledAt = toLocalIso(cursor)
        const key = buildMedicationLogId(plan.id, scheduledAt)
        const log = logMap.get(key)
        items.push({
          key,
          medicationId: plan.id,
          medicationName: plan.name,
          childId: plan.childId,
          scheduledAt,
          scheduledDate: scheduledAt.slice(0, 10),
          scheduledTime: scheduledAt.slice(11, 16),
          dosage: plan.dosage,
          dosageUnit: plan.dosageUnit,
          route: plan.route,
          instructions: plan.instructions,
          observations: plan.observations,
          reminderEnabled: plan.reminderEnabled,
          reminderMinutesBefore: plan.reminderMinutesBefore,
          status: getOccurrenceStatus(cursor, log),
          log,
          plan,
        })
      }
      cursor = new Date(cursor.getTime() + everyMs)
      iterations += 1
    }
  }

  return items.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
}

export function getMedicationOccurrencesForDate(plans: MedicationPlan[], logs: MedicationLog[], date: string) {
  return getMedicationOccurrencesInRange(plans, logs, date, date)
}

export function getUpcomingMedicationOccurrences(plans: MedicationPlan[], logs: MedicationLog[], fromDate: string, days = 7) {
  const end = new Date(`${fromDate}T12:00:00`)
  end.setDate(end.getDate() + Math.max(0, days - 1))
  return getMedicationOccurrencesInRange(plans, logs, fromDate, toLocalIso(end).slice(0, 10))
}
