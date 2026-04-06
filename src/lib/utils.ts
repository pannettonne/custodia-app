import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, addDays, startOfWeek, parseISO, isWithinInterval } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Child, CustodyPattern, CustodyOverride } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string, fmt = 'dd/MM/yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, fmt, { locale: es })
}

export function toISODate(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

/**
 * Determina qué progenitor tiene la custodia un día concreto,
 * teniendo en cuenta el patrón base y los overrides.
 */
export function getParentForDate(
  date: Date,
  pattern: CustodyPattern | null,
  overrides: CustodyOverride[],
  child: Child
): string | null {
  const dateStr = toISODate(date)

  // Primero, comprobar si hay un override para ese día
  const override = overrides.find((o) => o.date === dateStr)
  if (override) return override.parentId

  if (!pattern) return null

  const startDate = parseISO(pattern.startDate)
  const daysDiff = Math.floor((date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  if (daysDiff < 0) return null

  const parents = child.parents
  if (parents.length < 2) return parents[0] ?? null

  const startIdx = parents.indexOf(pattern.startParentId)
  if (startIdx === -1) return parents[0]

  let ownerIdx: number

  switch (pattern.type) {
    case 'alternating_weekly': {
      // Semanas alternas
      const weekNum = Math.floor(daysDiff / 7)
      ownerIdx = (startIdx + weekNum) % 2
      break
    }
    case 'alternating_biweekly': {
      // Quincenas alternas
      const biweekNum = Math.floor(daysDiff / 14)
      ownerIdx = (startIdx + biweekNum) % 2
      break
    }
    case '2-2-3': {
      // Patrón 2-2-3: L-M, X-J, V-S-D rotando
      const cycleDay = daysDiff % 14
      if (cycleDay < 2) ownerIdx = startIdx
      else if (cycleDay < 4) ownerIdx = 1 - startIdx
      else if (cycleDay < 7) ownerIdx = startIdx
      else if (cycleDay < 9) ownerIdx = 1 - startIdx
      else if (cycleDay < 11) ownerIdx = startIdx
      else ownerIdx = 1 - startIdx
      break
    }
    default:
      ownerIdx = startIdx
  }

  return parents[ownerIdx] ?? null
}

export const PARENT_COLORS = [
  '#3B82F6', // blue
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
]

export const PATTERN_LABELS: Record<string, string> = {
  alternating_weekly: 'Semanas alternas',
  alternating_biweekly: 'Quincenas alternas',
  '2-2-3': 'Patrón 2-2-3',
  custom: 'Personalizado',
}
