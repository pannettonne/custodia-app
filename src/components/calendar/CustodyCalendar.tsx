'use client'
import { useState, useMemo, useCallback } from 'react'
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isToday, addMonths, subMonths, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAppStore } from '@/store/app'
import { useAuth } from '@/lib/auth-context'
import { getParentForDate, toISODate, PERIOD_LABELS, formatDate } from '@/lib/utils'
import { RequestModal } from '@/components/requests/RequestModal'

const DAYS = ['L','M','X','J','V','S','D']

function noteMatchesDate(note: any, dateStr: string) {
  if (note.type === 'single') return note.date === dateStr
  if (note.type === 'range') return !!note.startDate && !!note.endDate && dateStr >= note.startDate && dateStr <= note.endDate
  return false
}

function eventMatchesDate(event: any, dateStr: string) {
  if (event.recurrence === 'weekly') {
    if (!event.date || !event.recurrenceUntil) return false
    if (dateStr < event.date || dateStr > event.recurrenceUntil) return false
    const jsDay = new Date(dateStr + 'T12:00:00').getDay()
    const weekday = jsDay === 0 ? 7 : jsDay
    const weekdays = Array.isArray(event.recurrenceWeekdays) && event.recurrenceWeekdays.length > 0
      ? event.recurrenceWeekdays
      : [(() => { const baseDay = new Date(event.date + 'T12:00:00').getDay(); return baseDay === 0 ? 7 : baseDay })()]
    return weekdays.includes(weekday)
  }

  if (event.recurrence === 'monthly') {
    if (!event.date || !event.recurrenceUntil) return false
    if (dateStr < event.date || dateStr > event.recurrenceUntil) return false
    const targetDay = Number((event.date || '').slice(8, 10))
    return Number(dateStr.slice(8, 10)) === targetDay
  }

  if (event.endDate) return dateStr >= event.date && dateStr <= event.endDate
  return event.date === dateStr
}

export function CustodyCalendar() {
  const { user } = useAuth()
  const { currentMonth, setCurrentMonth, children, selectedChildId, pattern, overrides, specialPeriods, notes, events, requests } = useAppStore()
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const child = useMemo(() => children.find(c => c.id === selectedChildId) ?? null, [children, selectedChildId])
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 })
    const result: Date[] = []
    let cur = start
    while (cur <= end) { result.push(cur); cur = addDays(cur, 1) }
    return result
  }, [currentMonth])

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
  const selectedEvents = useMemo(() => selectedDate ? events.filter(e => eventMatchesDate(e, selectedDate)) : [], [events, selectedDate])
  const selectedOverride = useMemo(() => selectedDate ? overrides.find(o => o.date === selectedDate) ?? null : null, [overrides, selectedDate])
  const selectedSpecialPeriod = useMemo(() => selectedDate ? getSpecialPeriodForDate(selectedDate) ?? null : null, [selectedDate, getSpecialPeriodForDate])
  const selectedRequests = useMemo(() => selectedDate ? requests.filter(r => ((r.type === 'single' && r.date === selectedDate) || (r.type === 'range' && r.startDate && r.endDate && selectedDate >= r.startDate && selectedDate <= r.endDate))) : [], [requests, selectedDate])
  const selectedParentInfo = useMemo(() => { if (!selectedDate || !child || !pattern) return null; return getParentInfo(new Date(selectedDate + 'T12:00:00')) }, [selectedDate, child, pattern, getParentInfo])

  if (!child) return <div className="empty-state"><div className="empty-state-icon">👶</div><div className="empty-state-title">No hay ningún menor configurado</div><div className="empty-state-sub">Ve a Configuración para añadir un menor</div></div>

  return (
    <div>
      <div className="calendar-month-nav"><button className="calendar-nav-btn" onClick={() => setCurrentMonth(subMonths(currentMonth,1))}>‹</button><div><div className="calendar-month-title">{format(currentMonth,'MMMM yyyy',{locale:es})}</div><div className="calendar-legend">{child.parents.map(pid => <div key={pid} className="legend-item"><div className="legend-dot" style={{background: child.parentColors?.[pid] ?? '#6B7280'}} /><span>{child.parentNames?.[pid] ?? 'Progenitor'}{pid===user?.uid?' (tú)':''}</span></div>)}</div></div><button className="calendar-nav-btn" onClick={() => setCurrentMonth(addMonths(currentMonth,1))}>›</button></div>

      {activeSpecialPeriods.length > 0 && <div style={{marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 4}}>{activeSpecialPeriods.map(sp => { const color = child.parentColors?.[sp.parentId] ?? '#6B7280'; const name = child.parentNames?.[sp.parentId] ?? 'Progenitor'; const labelStr = sp.label === 'otro' ? (sp.customLabel ?? 'Período especial') : PERIOD_LABELS[sp.label]; return <div key={sp.id} style={{display:'flex', alignItems:'center', gap:8, padding:'6px 10px', borderRadius:10, background: color+'18', border:`1px solid ${color}33`}}><span style={{fontSize:13}}>{labelStr.split(' ')[0]}</span><span style={{fontSize:11, fontWeight:700, color}}>{labelStr.replace(/^.\s/,'')}</span><span style={{fontSize:11, color:'#9ca3af'}}>→ {name} · {sp.startDate.slice(8)}/{sp.startDate.slice(5,7)} – {sp.endDate.slice(8)}/{sp.endDate.slice(5,7)}</span></div> })}</div>}

      <div className="day-headers">{DAYS.map(d => <div key={d} className="day-header">{d}</div>)}</div>

      <div className="cal-grid">
        {days.map(date => {
          const inMonth = isSameMonth(date, currentMonth)
          const dateStr = toISODate(date)
          const info = inMonth ? getParentInfo(date) : null
          const todayDay = isToday(date)
          const isOverride = inMonth && overrides.some(o => o.date === dateStr)
          const sp = inMonth ? getSpecialPeriodForDate(dateStr) : null
          const isSpecialStart = sp && sp.startDate === dateStr
          const hasNotes = inMonth && notes.some(n => noteMatchesDate(n, dateStr))
          const hasEvents = inMonth && events.some(e => eventMatchesDate(e, dateStr))
          const isSelected = selectedDate === dateStr
          return <div key={date.toISOString()} className={`cal-cell${!inMonth?' other-month':''}${todayDay?' today':''}`} style={info ? { background: info.color+'28', borderColor: isSelected ? '#ffffffaa' : (sp ? info.color+'99' : info.color+'55'), borderWidth: isSelected || sp ? 2 : 1 } : { background:'rgba(255,255,255,0.03)', borderColor:isSelected ? '#ffffff88' : 'rgba(255,255,255,0.07)', borderWidth:isSelected ? 2 : 1 }} onClick={() => { if(inMonth){ setSelectedDate(dateStr) } }}><div className="cal-day-num">{format(date,'d')}</div>{info && <div className="cal-day-name" style={{color:info.color}}>{info.name.split(' ')[0].slice(0,4)}</div>}{isOverride && <div className="cal-modified-dot" />}{sp && isSpecialStart && <div style={{position:'absolute',top:1,left:1,width:5,height:5,borderRadius:'50%',background:'#fff',opacity:0.7}} />}{todayDay && <div className="cal-today-dot" />}{(hasNotes || hasEvents) && <div style={{ position:'absolute', bottom:4, left:'50%', transform:'translateX(-50%)', display:'flex', gap:4, alignItems:'center' }}>{hasNotes && <div style={{ width:6, height:6, borderRadius:'50%', background:'#f59e0b' }} />}{hasEvents && <div style={{ width:6, height:6, borderRadius:'50%', background:'#10b981' }} />}</div>}</div>
        })}
      </div>

      <div style={{marginTop:14,display:'flex',alignItems:'center',justifyContent:'space-between'}}><div style={{display:'flex',alignItems:'center',gap:12,fontSize:11,color:'#6b7280', flexWrap:'wrap'}}><div style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:8,height:8,borderRadius:'50%',background:'#fbbf24'}} />cambio puntual</div><div style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:8,height:8,borderRadius:'50%',background:'#fff',opacity:0.6}} />periodo especial</div><div style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:8,height:8,borderRadius:'50%',background:'#f59e0b'}} />notas</div><div style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:8,height:8,borderRadius:'50%',background:'#10b981'}} />eventos</div></div><button onClick={() => { setSelectedDate(null); setModalOpen(true) }} style={{fontSize:12,color:'#3B82F6',background:'none',border:'none',cursor:'pointer',fontWeight:600}}>+ Solicitar cambio</button></div>

      {selectedDate && <div className="card" style={{ marginTop: 14 }}><div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, marginBottom:12 }}><div><div style={{ fontSize: 14, fontWeight: 800, color:'#fff' }}>{formatDate(selectedDate)}</div>{selectedParentInfo && <div style={{ fontSize:12, color:'#9ca3af', marginTop:4 }}>Corresponde a <strong style={{ color:selectedParentInfo.color }}>{selectedParentInfo.name}</strong>{selectedParentInfo.isMe ? ' (tú)' : ''}</div>}</div><button onClick={() => setModalOpen(true)} style={{ padding:'9px 12px', borderRadius:10, border:'none', background:'#3B82F6', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>Solicitar cambio</button></div>
        {selectedOverride && <div style={{ marginBottom:10, padding:'10px 12px', borderRadius:12, background:'rgba(251,191,36,0.12)', border:'1px solid rgba(251,191,36,0.25)' }}><div style={{ fontSize:12, fontWeight:700, color:'#fbbf24', marginBottom:4 }}>Cambio puntual aplicado</div><div style={{ fontSize:12, color:'#d1d5db' }}>{selectedOverride.reason || 'Sin observaciones'}</div></div>}
        {selectedSpecialPeriod && <div style={{ marginBottom:10, padding:'10px 12px', borderRadius:12, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)' }}><div style={{ fontSize:12, fontWeight:700, color:'#fff', marginBottom:4 }}>{selectedSpecialPeriod.label === 'otro' ? (selectedSpecialPeriod.customLabel ?? 'Período especial') : PERIOD_LABELS[selectedSpecialPeriod.label]}</div><div style={{ fontSize:12, color:'#9ca3af' }}>Periodo especial activo este día</div></div>}
        <div style={{ display:'grid', gap:10 }}>
          <div><div style={{ fontSize:12, fontWeight:700, color:'#f59e0b', marginBottom:6 }}>Notas del día</div>{selectedNotes.length === 0 ? <div style={{ fontSize:12, color:'#6b7280' }}>No hay notas para este día.</div> : <div style={{ display:'flex', flexDirection:'column', gap:8 }}>{selectedNotes.map(note => <div key={note.id} style={{ padding:'10px 12px', borderRadius:12, background:'rgba(245,158,11,0.10)', border:'1px solid rgba(245,158,11,0.2)' }}><div style={{ fontSize:11, color:'#f59e0b', fontWeight:700, marginBottom:4 }}>{note.tag.toUpperCase()}</div><div style={{ fontSize:12, color:'#e5e7eb' }}>{note.text}</div><div style={{ fontSize:11, color:'#9ca3af', marginTop:6 }}>Por {note.createdByName}{note.mentionOther ? ' · notifica al otro progenitor' : ''}</div></div>)}</div>}</div>
          <div><div style={{ fontSize:12, fontWeight:700, color:'#10b981', marginBottom:6 }}>Eventos del día</div>{selectedEvents.length === 0 ? <div style={{ fontSize:12, color:'#6b7280' }}>No hay eventos para este día.</div> : <div style={{ display:'flex', flexDirection:'column', gap:8 }}>{selectedEvents.map(event => <div key={event.id} style={{ padding:'10px 12px', borderRadius:12, background:'rgba(16,185,129,0.10)', border:'1px solid rgba(16,185,129,0.2)' }}><div style={{ fontSize:12, color:'#e5e7eb', fontWeight:700 }}>{event.title}</div><div style={{ fontSize:11, color:'#9ca3af', marginTop:4 }}>{event.allDay ? 'Todo el día' : (event.time || 'Sin hora')} · {event.customCategory || event.category}</div>{event.notes && <div style={{ fontSize:11, color:'#cbd5e1', marginTop:6 }}>{event.notes}</div>}</div>)}</div>}</div>
          <div><div style={{ fontSize:12, fontWeight:700, color:'#60a5fa', marginBottom:6 }}>Solicitudes de cambio</div>{selectedRequests.length === 0 ? <div style={{ fontSize:12, color:'#6b7280' }}>No hay solicitudes para este día.</div> : <div style={{ display:'flex', flexDirection:'column', gap:8 }}>{selectedRequests.map(req => <div key={req.id} style={{ padding:'10px 12px', borderRadius:12, background:'rgba(59,130,246,0.10)', border:'1px solid rgba(59,130,246,0.2)' }}><div style={{ fontSize:12, color:'#e5e7eb', fontWeight:700 }}>{req.fromParentName}</div><div style={{ fontSize:11, color:'#9ca3af', marginTop:4 }}>{req.reason}</div><div style={{ fontSize:11, color:req.status === 'pending' ? '#fbbf24' : req.status === 'accepted' ? '#10b981' : '#f87171', marginTop:6, fontWeight:700 }}>{req.status.toUpperCase()}</div></div>)}</div>}</div>
        </div>
      </div>}

      {modalOpen && <RequestModal open={modalOpen} onClose={() => { setModalOpen(false) }} initialDate={selectedDate} />}
    </div>
  )
}
