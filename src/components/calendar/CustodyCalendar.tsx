'use client'
import { useEffect, useState, useMemo, useCallback } from 'react'
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isToday, addMonths, subMonths, format, addWeeks, subWeeks } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAppStore } from '@/store/app'
import { useAuth } from '@/lib/auth-context'
import { getParentForDate, toISODate, PERIOD_LABELS, formatDate } from '@/lib/utils'
import { RequestModal } from '@/components/requests/RequestModal'
import { cancelEventOccurrence, restoreEventOccurrence } from '@/lib/db'
import { printMonthlyCalendar } from '@/lib/monthly-print'

const DAYS = ['L','M','X','J','V','S','D']
type CalendarViewMode = 'day' | 'week' | 'month'

function noteMatchesDate(note: any, dateStr: string) {
  if (note.type === 'single') return note.date === dateStr
  if (note.type === 'range') return !!note.startDate && !!note.endDate && dateStr >= note.startDate && dateStr <= note.endDate
  return false
}

function getEventOccurrenceState(event: any, dateStr: string) {
  const cancelled = Array.isArray(event.cancelledDates) && event.cancelledDates.includes(dateStr)
  if (event.recurrence === 'weekly') {
    if (!event.date || !event.recurrenceUntil) return { matches: false, cancelled }
    if (dateStr < event.date || dateStr > event.recurrenceUntil) return { matches: false, cancelled }
    const jsDay = new Date(dateStr + 'T12:00:00').getDay()
    const weekday = jsDay === 0 ? 7 : jsDay
    const weekdays = Array.isArray(event.recurrenceWeekdays) && event.recurrenceWeekdays.length > 0 ? event.recurrenceWeekdays : [(() => { const baseDay = new Date(event.date + 'T12:00:00').getDay(); return baseDay === 0 ? 7 : baseDay })()]
    return { matches: weekdays.includes(weekday), cancelled }
  }
  if (event.recurrence === 'monthly') {
    if (!event.date || !event.recurrenceUntil) return { matches: false, cancelled }
    if (dateStr < event.date || dateStr > event.recurrenceUntil) return { matches: false, cancelled }
    const targetDay = Number((event.date || '').slice(8, 10))
    return { matches: Number(dateStr.slice(8, 10)) === targetDay, cancelled }
  }
  if (event.endDate) return { matches: dateStr >= event.date && dateStr <= event.endDate, cancelled }
  return { matches: event.date === dateStr, cancelled }
}

function requestMatchesDate(request: any, dateStr: string) {
  return request.status === 'pending' && (
    (request.type === 'single' && request.date === dateStr) ||
    (request.type === 'range' && request.startDate && request.endDate && dateStr >= request.startDate && dateStr <= request.endDate)
  )
}

function DetailSection({ title, color, empty, children }: { title: string; color: string; empty: string; children: React.ReactNode }) {
  const hasContent = Array.isArray(children) ? children.length > 0 : !!children
  return (
    <div style={{ padding:'14px 14px 12px', borderRadius:18, border:'1px solid var(--border)', background:'var(--bg-card)' }}>
      <div style={{ fontSize:12, fontWeight:800, color, marginBottom:8, letterSpacing:0.2 }}>{title}</div>
      {hasContent ? children : <div style={{ fontSize:12, color:'var(--text-muted)' }}>{empty}</div>}
    </div>
  )
}

export function CustodyCalendar() {
  const { user } = useAuth()
  const { currentMonth, setCurrentMonth, children, selectedChildId, pattern, overrides, specialPeriods, notes, events, requests, selectedCalendarDate, setSelectedCalendarDate } = useAppStore()
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(selectedCalendarDate ?? toISODate(new Date()))
  const [eventActionLoading, setEventActionLoading] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<CalendarViewMode>('week')

  useEffect(() => {
    if (selectedCalendarDate) {
      setSelectedDate(selectedCalendarDate)
      setCurrentMonth(new Date(selectedCalendarDate + 'T12:00:00'))
    }
  }, [selectedCalendarDate, setCurrentMonth])

  const child = useMemo(() => children.find(c => c.id === selectedChildId) ?? null, [children, selectedChildId])
  const anchorDate = useMemo(() => new Date((selectedDate || toISODate(new Date())) + 'T12:00:00'), [selectedDate])
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 })
    const result: Date[] = []
    let cur = start
    while (cur <= end) { result.push(cur); cur = addDays(cur, 1) }
    return result
  }, [currentMonth])
  const weekDays = useMemo(() => {
    const start = startOfWeek(anchorDate, { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }, [anchorDate])

  const monthStr = format(currentMonth, 'yyyy-MM')
  const activeSpecialPeriods = useMemo(() => specialPeriods.filter(p => p.startDate.startsWith(monthStr) || p.endDate.startsWith(monthStr) || (p.startDate < monthStr + '-01' && p.endDate > monthStr + '-31')), [specialPeriods, monthStr])
  const getParentInfo = useCallback((date: Date) => {
    if (!child || !pattern) return null
    const parentId = getParentForDate(date, pattern, overrides, child, specialPeriods)
    if (!parentId) return null
    return { parentId, name: child.parentNames?.[parentId] ?? 'Progenitor', color: child.parentColors?.[parentId] ?? '#6B7280', isMe: parentId === user?.uid }
  }, [child, pattern, overrides, specialPeriods, user?.uid])
  const getSpecialPeriodForDate = useCallback((dateStr: string) => specialPeriods.find(p => dateStr >= p.startDate && dateStr <= p.endDate), [specialPeriods])

  const selectedNotes = useMemo(() => selectedDate ? notes.filter(n => noteMatchesDate(n, selectedDate)) : [], [notes, selectedDate])
  const selectedEvents = useMemo(() => selectedDate ? events.map(event => ({ event, ...getEventOccurrenceState(event, selectedDate) })).filter(item => item.matches) : [], [events, selectedDate])
  const selectedOverride = useMemo(() => selectedDate ? overrides.find(o => o.date === selectedDate) ?? null : null, [overrides, selectedDate])
  const selectedSpecialPeriod = useMemo(() => selectedDate ? getSpecialPeriodForDate(selectedDate) ?? null : null, [selectedDate, getSpecialPeriodForDate])
  const selectedRequests = useMemo(() => selectedDate ? requests.filter(r => ((r.type === 'single' && r.date === selectedDate) || (r.type === 'range' && r.startDate && r.endDate && selectedDate >= r.startDate && selectedDate <= r.endDate))) : [], [requests, selectedDate])
  const selectedParentInfo = useMemo(() => { if (!selectedDate || !child || !pattern) return null; return getParentInfo(new Date(selectedDate + 'T12:00:00')) }, [selectedDate, child, pattern, getParentInfo])

  const handleToggleOccurrence = async (eventId: string, isCancelled: boolean) => {
    if (!selectedDate) return
    setEventActionLoading(eventId)
    try {
      if (isCancelled) await restoreEventOccurrence(eventId, selectedDate)
      else await cancelEventOccurrence(eventId, selectedDate)
    } finally { setEventActionLoading(null) }
  }

  const handlePrint = () => {
    if (!child) return
    printMonthlyCalendar({ month: currentMonth, child, pattern, overrides, notes, events, specialPeriods })
  }

  const syncToDate = (dateStr: string) => {
    setSelectedDate(dateStr)
    setSelectedCalendarDate(dateStr)
    setCurrentMonth(new Date(dateStr + 'T12:00:00'))
  }

  const goToToday = () => {
    const todayStr = toISODate(new Date())
    syncToDate(todayStr)
  }

  const closeDayDetail = () => {
    setSelectedDate(null)
    setSelectedCalendarDate(null)
  }

  const navigatePeriod = (direction: -1 | 1) => {
    if (viewMode === 'month') {
      const next = direction === 1 ? addMonths(currentMonth, 1) : subMonths(currentMonth, 1)
      setCurrentMonth(next)
      return
    }
    if (viewMode === 'week') {
      const next = direction === 1 ? addWeeks(anchorDate, 1) : subWeeks(anchorDate, 1)
      syncToDate(toISODate(next))
      return
    }
    const next = addDays(anchorDate, direction)
    syncToDate(toISODate(next))
  }

  const headerLabel = useMemo(() => {
    if (viewMode === 'month') return format(currentMonth, 'MMMM yyyy', { locale: es })
    if (viewMode === 'week') {
      const start = weekDays[0]
      const end = weekDays[6]
      return `${format(start, 'd MMM', { locale: es })} · ${format(end, 'd MMM yyyy', { locale: es })}`
    }
    return format(anchorDate, "EEEE, d 'de' MMMM yyyy", { locale: es })
  }, [viewMode, currentMonth, weekDays, anchorDate])

  const renderDayDetail = () => {
    if (!selectedDate) return null
    return (
      <div style={{ marginTop: 16, display:'grid', gap:12 }}>
        <div className="card" style={{ padding:18, borderRadius:22, background:'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-soft) 100%)', border:'1px solid var(--border)' }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, flexWrap:'nowrap' }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, color:'var(--text-muted)', fontWeight:800, textTransform:'uppercase', letterSpacing:0.5, marginBottom:6 }}>Vista del día</div>
              <div style={{ fontSize:18, fontWeight:900, color:'var(--text-strong)' }}>{formatDate(selectedDate)}</div>
              {selectedParentInfo && <div style={{ fontSize:13, color:'var(--text-secondary)', marginTop:6 }}>Corresponde a <strong style={{ color:selectedParentInfo.color }}>{selectedParentInfo.name}</strong>{selectedParentInfo.isMe ? ' (tú)' : ''}</div>}
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center', flexShrink:0, marginLeft:8 }}>
              <button onClick={() => setModalOpen(true)} style={{ padding:'10px 13px', borderRadius:12, border:'none', background:'#3B82F6', color:'#fff', fontSize:12, fontWeight:800, cursor:'pointer', boxShadow:'0 8px 24px rgba(59,130,246,0.28)', whiteSpace:'nowrap' }}>Solicitar cambio</button>
              <button onClick={closeDayDetail} aria-label="Cerrar detalle del día" title="Cerrar" style={{ width:38, height:38, borderRadius:12, border:'1px solid var(--border)', background:'var(--bg-card)', color:'var(--text-secondary)', fontSize:18, fontWeight:800, lineHeight:1, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>×</button>
            </div>
          </div>
        </div>

        {selectedOverride && <div style={{ padding:'12px 14px', borderRadius:16, background:'rgba(251,191,36,0.12)', border:'1px solid rgba(251,191,36,0.25)' }}><div style={{ fontSize:12, fontWeight:800, color:'#fbbf24', marginBottom:4 }}>Cambio aprobado</div><div style={{ fontSize:12, color:'var(--text-secondary)' }}>{selectedOverride.reason || 'Sin observaciones'}</div></div>}
        {selectedSpecialPeriod && <div style={{ padding:'12px 14px', borderRadius:16, background:'var(--bg-soft)', border:'1px solid var(--border)' }}><div style={{ fontSize:12, fontWeight:800, color:'var(--text-strong)', marginBottom:4 }}>{selectedSpecialPeriod.label === 'otro' ? (selectedSpecialPeriod.customLabel ?? 'Período especial') : PERIOD_LABELS[selectedSpecialPeriod.label]}</div><div style={{ fontSize:12, color:'var(--text-secondary)' }}>Periodo especial activo este día</div></div>}

        <div style={{ display:'grid', gap:12 }}>
          <DetailSection title="Notas" color="#f59e0b" empty="No hay notas para este día.">{selectedNotes.length > 0 && <div style={{ display:'grid', gap:8 }}>{selectedNotes.map(note => <div key={note.id} style={{ padding:'10px 12px', borderRadius:14, background:'rgba(245,158,11,0.10)', border:'1px solid rgba(245,158,11,0.2)' }}><div style={{ fontSize:11, color:'#f59e0b', fontWeight:800, marginBottom:4 }}>{note.tag.toUpperCase()}</div><div style={{ fontSize:13, color:'var(--text-strong)' }}>{note.text}</div><div style={{ fontSize:11, color:'var(--text-secondary)', marginTop:6 }}>Por {note.createdByName}{note.mentionOther ? ' · notifica al otro progenitor' : ''}</div></div>)}</div>}</DetailSection>
          <DetailSection title="Eventos" color="#10b981" empty="No hay eventos para este día.">{selectedEvents.length > 0 && <div style={{ display:'grid', gap:8 }}>{selectedEvents.map(({ event, cancelled }) => <div key={event.id} style={{ padding:'10px 12px', borderRadius:14, background: cancelled ? 'rgba(239,68,68,0.10)' : 'rgba(16,185,129,0.10)', border: cancelled ? '1px solid rgba(239,68,68,0.25)' : '1px solid rgba(16,185,129,0.2)', opacity: cancelled ? 0.9 : 1 }}><div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}><div><div style={{ fontSize:13, color:'var(--text-strong)', fontWeight:800 }}>{event.title}</div><div style={{ fontSize:11, color:'var(--text-secondary)', marginTop:4 }}>{event.allDay ? 'Todo el día' : (event.time || 'Sin hora')} · {event.customCategory || event.category}</div></div>{event.recurrence && event.recurrence !== 'none' && event.createdBy === user?.uid && <button onClick={() => handleToggleOccurrence(event.id, cancelled)} disabled={eventActionLoading === event.id} style={{ background:'none', border:'none', color: cancelled ? '#10b981' : '#f87171', fontSize:12, fontWeight:800, cursor:'pointer' }}>{eventActionLoading === event.id ? '...' : cancelled ? 'Restaurar' : 'Cancelar'}</button>}</div>{cancelled && <div style={{ fontSize:11, color:'#f87171', marginTop:6, fontWeight:800 }}>Cancelado</div>}{event.notes && <div style={{ fontSize:11, color:'var(--text-secondary)', marginTop:6 }}>{event.notes}</div>}</div>)}</div>}</DetailSection>
          <DetailSection title="Solicitudes de cambio" color="#60a5fa" empty="No hay solicitudes para este día.">{selectedRequests.length > 0 && <div style={{ display:'grid', gap:8 }}>{selectedRequests.map(req => <div key={req.id} style={{ padding:'10px 12px', borderRadius:14, background:'rgba(59,130,246,0.10)', border:'1px solid rgba(59,130,246,0.2)' }}><div style={{ fontSize:13, color:'var(--text-strong)', fontWeight:800 }}>{req.fromParentName}</div><div style={{ fontSize:11, color:'var(--text-secondary)', marginTop:4 }}>{req.reason}</div><div style={{ fontSize:11, color:req.status === 'pending' ? '#fbbf24' : req.status === 'accepted' ? '#10b981' : req.status === 'cancelled' ? 'var(--text-muted)' : '#f87171', marginTop:6, fontWeight:800 }}>{req.status.toUpperCase()}</div></div>)}</div>}</DetailSection>
        </div>
      </div>
    )
  }

  if (!child) return <div className="empty-state"><div className="empty-state-icon">👶</div><div className="empty-state-title">No hay ningún menor configurado</div><div className="empty-state-sub">Ve a Configuración para añadir un menor</div></div>

  return (
    <div>
      <div style={{ padding:5, borderRadius:16, background:'var(--bg-soft)', border:'1px solid var(--border)', display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:5, marginBottom:12 }}>
        {([['day', 'Día'], ['week', 'Semana'], ['month', 'Mes']] as const).map(([value, label]) => (
          <button key={value} onClick={() => { setViewMode(value); if (!selectedDate) goToToday() }} style={{ padding:'10px 6px', borderRadius:12, border:'none', background:viewMode === value ? 'linear-gradient(180deg, #3B82F6 0%, #2563EB 100%)' : 'transparent', color:viewMode === value ? '#fff' : 'var(--text-secondary)', fontSize:12, fontWeight:800, cursor:'pointer', boxShadow:viewMode === value ? '0 8px 20px rgba(59,130,246,0.18)' : 'none' }}>{label}</button>
        ))}
      </div>

      <div className="card" style={{ padding:14, borderRadius:20, marginBottom:12, background:'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-soft) 100%)', border:'1px solid var(--border)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
          <button className="calendar-nav-btn" onClick={() => navigatePeriod(-1)} style={{ width:34, height:34, borderRadius:10 }}>‹</button>
          <div style={{ textAlign:'center', flex:1 }}>
            <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:800, textTransform:'uppercase', letterSpacing:0.4, marginBottom:3 }}>Calendario</div>
            <div className="calendar-month-title" style={{ textTransform:'capitalize', fontSize:18 }}>{headerLabel}</div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, flexWrap:'wrap', marginTop:6 }}>{child.parents.map(pid => <div key={pid} style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 8px', borderRadius:999, background:'var(--bg-card)', border:'1px solid var(--border)' }}><div style={{ width:7, height:7, borderRadius:'50%', background:child.parentColors?.[pid] ?? '#6B7280' }} /><span style={{ fontSize:10, color:'var(--text-secondary)', fontWeight:700 }}>{child.parentNames?.[pid] ?? 'Progenitor'}{pid===user?.uid ? ' · tú' : ''}</span></div>)}</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <button onClick={goToToday} style={{ fontSize:11, color:'#3B82F6', background:'none', border:'none', cursor:'pointer', fontWeight:800 }}>Hoy</button>
            <button className="calendar-nav-btn" onClick={() => navigatePeriod(1)} style={{ width:34, height:34, borderRadius:10 }}>›</button>
          </div>
        </div>
      </div>

      {viewMode === 'month' && activeSpecialPeriods.length > 0 && <div style={{ marginBottom: 12, display: 'grid', gap: 6 }}>{activeSpecialPeriods.map(sp => { const color = child.parentColors?.[sp.parentId] ?? '#6B7280'; const name = child.parentNames?.[sp.parentId] ?? 'Progenitor'; const labelStr = sp.label === 'otro' ? (sp.customLabel ?? 'Período especial') : PERIOD_LABELS[sp.label]; return <div key={sp.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 11px', borderRadius:14, background: color+'14', border:`1px solid ${color}33` }}><span style={{ fontSize:11, fontWeight:800, color }}>{labelStr}</span><span style={{ fontSize:11, color:'var(--text-secondary)' }}>· {name} · {sp.startDate.slice(8)}/{sp.startDate.slice(5,7)} – {sp.endDate.slice(8)}/{sp.endDate.slice(5,7)}</span></div> })}</div>}

      {viewMode === 'month' && (
        <>
          <div className="day-headers" style={{ marginBottom:8 }}>{DAYS.map(d => <div key={d} className="day-header" style={{ fontWeight:800, color:'var(--text-muted)' }}>{d}</div>)}</div>
          <div className="cal-grid" style={{ gap:8 }}>{days.map(date => {
            const inMonth = isSameMonth(date, currentMonth)
            const dateStr = toISODate(date)
            const info = inMonth ? getParentInfo(date) : null
            const todayDay = isToday(date)
            const isOverride = inMonth && overrides.some(o => o.date === dateStr)
            const hasPendingRequest = inMonth && requests.some(r => requestMatchesDate(r, dateStr))
            const sp = inMonth ? getSpecialPeriodForDate(dateStr) : null
            const hasNotes = inMonth && notes.some(n => noteMatchesDate(n, dateStr))
            const hasEvents = inMonth && events.some(e => getEventOccurrenceState(e, dateStr).matches)
            const isSelected = selectedDate === dateStr
            return <div key={date.toISOString()} className={`cal-cell${!inMonth?' other-month':''}${todayDay?' today':''}`} style={{ background: info ? info.color+'18' : 'var(--bg-card)', borderColor: isSelected ? '#3B82F6' : hasPendingRequest ? '#60a5fa' : sp && info ? info.color+'80' : 'var(--border)', borderWidth:isSelected || hasPendingRequest || !!sp ? 2 : 1, borderStyle:hasPendingRequest ? 'dashed' : 'solid', borderRadius:18, boxShadow:isSelected ? '0 10px 22px rgba(59,130,246,0.14)' : 'none' }} onClick={() => { if(inMonth){ syncToDate(dateStr) } }}><div className="cal-day-num" style={{ fontWeight:800 }}>{format(date,'d')}</div>{info && <div className="cal-day-name" style={{ color:info.color, fontWeight:700 }}>{info.name.split(' ')[0].slice(0,4)}</div>}{isOverride && <div className="cal-modified-dot" />}{hasPendingRequest && <div style={{ position:'absolute', top:6, left:6, fontSize:8, color:'#60a5fa', fontWeight:900 }}>P</div>}{todayDay && <div className="cal-today-dot" />}{(hasNotes || hasEvents) && <div style={{ position:'absolute', bottom:6, left:'50%', transform:'translateX(-50%)', display:'flex', gap:5, alignItems:'center' }}>{hasNotes && <div style={{ width:6, height:6, borderRadius:'50%', background:'#f59e0b' }} />}{hasEvents && <div style={{ width:6, height:6, borderRadius:'50%', background:'#10b981' }} />}</div>}</div>
          })}</div>
          <div style={{ marginTop:14, display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap', padding:'0 2px' }}><div style={{ display:'flex', alignItems:'center', gap:12, fontSize:11, color:'var(--text-muted)', flexWrap:'wrap' }}><div style={{ display:'flex', alignItems:'center', gap:4 }}><div style={{ width:8, height:8, borderRadius:'50%', background:'#fbbf24' }} />cambio puntual</div><div style={{ display:'flex', alignItems:'center', gap:4 }}><div style={{ width:8, height:8, borderRadius:'50%', background:'#60a5fa' }} />solicitud pendiente</div><div style={{ display:'flex', alignItems:'center', gap:4 }}><div style={{ width:8, height:8, borderRadius:'50%', background:'#f59e0b' }} />notas</div><div style={{ display:'flex', alignItems:'center', gap:4 }}><div style={{ width:8, height:8, borderRadius:'50%', background:'#10b981' }} />eventos</div></div><div style={{ display:'flex', gap:8 }}><button onClick={handlePrint} style={{ fontSize:12, color:'#10b981', background:'none', border:'none', cursor:'pointer', fontWeight:800 }}>🖨️ Imprimir / PDF</button><button onClick={() => { setSelectedDate(null); setSelectedCalendarDate(null); setModalOpen(true) }} style={{ fontSize:12, color:'#3B82F6', background:'none', border:'none', cursor:'pointer', fontWeight:800 }}>+ Solicitar cambio</button></div></div>
          {renderDayDetail()}
        </>
      )}

      {viewMode === 'week' && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7, minmax(0, 1fr))', gap:6 }}>
            {weekDays.map(day => {
              const dateStr = toISODate(day)
              const info = getParentInfo(day)
              const itemsNotes = notes.filter(n => noteMatchesDate(n, dateStr))
              const itemsEvents = events.map(event => ({ event, ...getEventOccurrenceState(event, dateStr) })).filter(item => item.matches)
              const pendingCount = requests.filter(r => requestMatchesDate(r, dateStr)).length
              const isSelected = selectedDate === dateStr
              return <button key={dateStr} onClick={() => syncToDate(dateStr)} style={{ minWidth:0, textAlign:'center', padding:'10px 4px', borderRadius:16, border:`1px solid ${isSelected ? '#3B82F6' : 'var(--border)'}`, background:isSelected ? 'linear-gradient(180deg, rgba(59,130,246,0.14) 0%, var(--bg-card) 100%)' : (info ? info.color+'12' : 'var(--bg-card)'), color:'inherit', cursor:'pointer', boxShadow:isSelected ? '0 8px 18px rgba(59,130,246,0.12)' : 'none' }}><div style={{ fontSize:9, color:'var(--text-muted)', textTransform:'uppercase', fontWeight:800, marginBottom:4 }}>{format(day, 'EEE', { locale: es })}</div><div style={{ fontSize:16, fontWeight:900, color:'var(--text-strong)', lineHeight:1 }}>{format(day, 'd', { locale: es })}</div><div style={{ fontSize:9, color:'var(--text-secondary)', marginTop:3 }}>{format(day, 'MMM', { locale: es })}</div>{info && <div style={{ fontSize:9, fontWeight:800, color:info.color, marginTop:6, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{info.name.split(' ')[0]}</div>}<div style={{ display:'flex', justifyContent:'center', gap:4, marginTop:7, flexWrap:'wrap' }}>{itemsEvents.length > 0 && <span style={{ fontSize:9, color:'#10b981', fontWeight:800 }}>{itemsEvents.length}E</span>}{itemsNotes.length > 0 && <span style={{ fontSize:9, color:'#f59e0b', fontWeight:800 }}>{itemsNotes.length}N</span>}{pendingCount > 0 && <span style={{ fontSize:9, color:'#60a5fa', fontWeight:800 }}>{pendingCount}C</span>}{itemsEvents.length === 0 && itemsNotes.length === 0 && pendingCount === 0 && <span style={{ fontSize:9, color:'var(--text-muted)' }}>—</span>}</div></button>
            })}
          </div>
          {renderDayDetail()}
        </>
      )}

      {viewMode === 'day' && renderDayDetail()}

      {modalOpen && <RequestModal open={modalOpen} onClose={() => { setModalOpen(false) }} initialDate={selectedDate} />}
    </div>
  )
}
