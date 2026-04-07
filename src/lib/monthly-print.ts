import { addDays, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Child, CustodyOverride, CustodyPattern, Note, SchoolEvent, SpecialPeriod } from '@/types'
import { getParentForDate, toISODate } from '@/lib/utils'

function noteMatchesDate(note: any, dateStr: string) {
  if (note.type === 'single') return note.date === dateStr
  if (note.type === 'range') return !!note.startDate && !!note.endDate && dateStr >= note.startDate && dateStr <= note.endDate
  return false
}

function eventMatchesDate(event: any, dateStr: string) {
  const cancelled = Array.isArray(event.cancelledDates) && event.cancelledDates.includes(dateStr)
  if (cancelled) return false
  if (event.recurrence === 'weekly') {
    if (!event.date || !event.recurrenceUntil) return false
    if (dateStr < event.date || dateStr > event.recurrenceUntil) return false
    const jsDay = new Date(dateStr + 'T12:00:00').getDay()
    const weekday = jsDay === 0 ? 7 : jsDay
    const weekdays = Array.isArray(event.recurrenceWeekdays) && event.recurrenceWeekdays.length > 0 ? event.recurrenceWeekdays : [(() => { const baseDay = new Date(event.date + 'T12:00:00').getDay(); return baseDay === 0 ? 7 : baseDay })()]
    return weekdays.includes(weekday)
  }
  if (event.recurrence === 'monthly') {
    if (!event.date || !event.recurrenceUntil) return false
    if (dateStr < event.date || dateStr > event.recurrenceUntil) return false
    return Number(dateStr.slice(8, 10)) === Number((event.date || '').slice(8, 10))
  }
  if (event.endDate) return dateStr >= event.date && dateStr <= event.endDate
  return event.date === dateStr
}

export function printMonthlyCalendar(params: {
  month: Date
  child: Child
  pattern: CustodyPattern | null
  overrides: CustodyOverride[]
  notes: Note[]
  events: SchoolEvent[]
  specialPeriods: SpecialPeriod[]
}) {
  const { month, child, pattern, overrides, notes, events, specialPeriods } = params
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
  const days: Date[] = []
  let cur = start
  while (cur <= end) { days.push(cur); cur = addDays(cur, 1) }

  const cells = days.map(date => {
    const dateStr = toISODate(date)
    const inMonth = isSameMonth(date, month)
    const parentId = pattern ? getParentForDate(date, pattern, overrides, child, specialPeriods) : child.parents[0] ?? null
    const parentName = parentId ? (child.parentNames?.[parentId] ?? 'Progenitor') : ''
    const parentColor = parentId ? (child.parentColors?.[parentId] ?? '#9ca3af') : '#9ca3af'
    const hasOverride = overrides.some(o => o.date === dateStr)
    const period = specialPeriods.find(p => dateStr >= p.startDate && dateStr <= p.endDate)
    const dayNotes = notes.filter(n => noteMatchesDate(n, dateStr)).slice(0, 2)
    const dayEvents = events.filter(e => eventMatchesDate(e, dateStr)).slice(0, 2)
    return `
      <div class="cell ${inMonth ? '' : 'other'}">
        <div class="head"><span class="day">${format(date, 'd')}</span>${hasOverride ? '<span class="override">Cambio</span>' : ''}</div>
        <div class="owner" style="color:${parentColor}">${parentName}</div>
        ${period ? '<div class="period">Periodo especial</div>' : ''}
        ${dayNotes.map(note => `<div class="note">• Nota: ${escapeHtml(note.text.slice(0, 28))}${note.text.length > 28 ? '…' : ''}</div>`).join('')}
        ${dayEvents.map(event => `<div class="event">• ${escapeHtml(event.title)}</div>`).join('')}
      </div>
    `
  }).join('')

  const legend = child.parents.map(pid => `<div class="legend-item"><span class="dot" style="background:${child.parentColors?.[pid] ?? '#6b7280'}"></span>${escapeHtml(child.parentNames?.[pid] ?? 'Progenitor')}</div>`).join('')

  const html = `
  <!doctype html>
  <html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(child.name)} · ${escapeHtml(format(month, 'MMMM yyyy', { locale: es }))}</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 24px; color: #111827; }
      .title { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:18px; }
      .title h1 { margin:0; font-size:28px; }
      .title p { margin:4px 0 0; color:#4b5563; font-size:16px; text-transform:capitalize; }
      .legend { display:flex; gap:14px; flex-wrap:wrap; margin-bottom:18px; font-size:12px; color:#374151; }
      .legend-item { display:flex; align-items:center; gap:6px; }
      .dot { width:10px; height:10px; border-radius:50%; display:inline-block; }
      .grid { display:grid; grid-template-columns:repeat(7, 1fr); gap:8px; }
      .dow { font-size:12px; font-weight:700; text-align:center; color:#374151; padding-bottom:4px; }
      .cell { min-height:120px; border:1px solid #e5e7eb; border-radius:12px; padding:8px; background:#fff; }
      .cell.other { background:#f9fafb; opacity:0.5; }
      .head { display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; }
      .day { font-size:14px; font-weight:800; }
      .override { font-size:11px; font-weight:700; color:#d97706; }
      .owner { font-size:11px; font-weight:700; margin-bottom:6px; }
      .period { font-size:10px; color:#6b7280; margin-bottom:6px; }
      .note, .event { font-size:10px; margin-bottom:3px; }
      .note { color:#b45309; }
      .event { color:#047857; }
      @media print { body { padding: 10mm; } }
    </style>
  </head>
  <body>
    <div class="title">
      <div>
        <h1>${escapeHtml(child.name)}</h1>
        <p>${escapeHtml(format(month, 'MMMM yyyy', { locale: es }))}</p>
      </div>
      <div style="font-size:12px;color:#6b7280">Generado desde CustodiaApp</div>
    </div>
    <div class="legend">${legend}<div class="legend-item">🟡 cambio puntual</div><div class="legend-item">🟠 notas</div><div class="legend-item">🟢 eventos</div></div>
    <div class="grid">
      <div class="dow">Lunes</div><div class="dow">Martes</div><div class="dow">Miércoles</div><div class="dow">Jueves</div><div class="dow">Viernes</div><div class="dow">Sábado</div><div class="dow">Domingo</div>
      ${cells}
    </div>
    <script>window.onload = () => window.print()</script>
  </body>
  </html>`

  const popup = window.open('', '_blank', 'width=1200,height=900')
  if (!popup) return
  popup.document.open()
  popup.document.write(html)
  popup.document.close()
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
