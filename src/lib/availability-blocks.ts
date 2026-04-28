import { eachDayOfInterval } from 'date-fns'
import { formatDate } from './utils'
import type { AvailabilityBlock } from '@/types'

export function getAvailabilityBlockDateRange(block: AvailabilityBlock) {
  if (block.type === 'partial_slot' || block.type === 'full_day') {
    const date = block.date || block.startDate || block.endDate || ''
    return { startDate: date, endDate: date }
  }
  return {
    startDate: block.startDate || block.date || '',
    endDate: block.endDate || block.startDate || block.date || '',
  }
}

export function formatAvailabilityBlockLabel(block: AvailabilityBlock) {
  if (block.type === 'partial_slot') {
    return `${formatDate(block.date || '')} · ${block.startTime || '--:--'}-${block.endTime || '--:--'}`
  }
  if (block.type === 'date_range') {
    return `${formatDate(block.startDate || '')} → ${formatDate(block.endDate || block.startDate || '')}`
  }
  return `${formatDate(block.date || block.startDate || '')} · día completo`
}

function dateRangesOverlap(startA: string, endA: string, startB: string, endB: string) {
  return !(endA < startB || endB < startA)
}

function timeRangesOverlap(startA: string, endA: string, startB: string, endB: string) {
  return startA < endB && startB < endA
}

function pointFallsWithinRange(point: string, start: string, end: string) {
  return point >= start && point < end
}

export function blockOverlapsDate(block: AvailabilityBlock, date: string) {
  const range = getAvailabilityBlockDateRange(block)
  return date >= range.startDate && date <= range.endDate
}

export function findAvailabilityConflict(args: {
  blocks: AvailabilityBlock[]
  startDate: string
  endDate?: string
  startTime?: string
  endTime?: string
}) {
  const { blocks, startDate, endDate, startTime, endTime } = args
  const effectiveEndDate = endDate || startDate
  const isPartialRequest = !!startTime && !!endTime && startDate === effectiveEndDate
  const isPointRequest = !!startTime && !endTime && startDate === effectiveEndDate

  return blocks.find(block => {
    const blockRange = getAvailabilityBlockDateRange(block)
    if (!dateRangesOverlap(startDate, effectiveEndDate, blockRange.startDate, blockRange.endDate)) return false

    if (!isPartialRequest && !isPointRequest) return true

    if (block.type !== 'partial_slot') return true
    if ((block.date || blockRange.startDate) !== startDate) return false

    if (isPartialRequest) {
      return timeRangesOverlap(startTime!, endTime!, block.startTime || '00:00', block.endTime || '23:59')
    }

    return pointFallsWithinRange(startTime!, block.startTime || '00:00', block.endTime || '23:59')
  }) || null
}

export function getAvailabilityConflictMessage(targetName: string, block: AvailabilityBlock) {
  return `No se puede enviar. ${targetName} tiene bloqueado este periodo: ${formatAvailabilityBlockLabel(block)}.`
}

export function expandDatesForFullDayRequest(startDate: string, endDate?: string) {
  const effectiveEndDate = endDate || startDate
  return eachDayOfInterval({
    start: new Date(`${startDate}T12:00:00`),
    end: new Date(`${effectiveEndDate}T12:00:00`),
  }).map(item => item.toISOString().slice(0, 10))
}
