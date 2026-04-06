'use client'
import { useState, useMemo, useCallback } from 'react'
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isToday, addMonths, subMonths, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAppStore } from '@/store/app'
import { useAuth } from '@/lib/auth-context'
import { getParentForDate, toISODate } from '@/lib/utils'
import { RequestModal } from '@/components/requests/RequestModal'

const DAYS = ['L','M','X','J','V','S','D']

export function CustodyCalendar() {
  const { user } = useAuth()
  const { currentMonth, setCurrentMonth, children, selectedChildId, pattern, overrides } = useAppStore()
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string|null>(null)

  const child = useMemo(() => children.find(c => c.id === selectedChildId) ?? null, [children, selectedChildId])

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 })
    const result: Date[] = []
    let cur = start
    while (cur <= end) { result.push(cur); cur = addDays(cur, 1) }
    return result
  }, [currentMonth])

  const getParentInfo = useCallback((date: Date) => {
    if (!child || !pattern) return null
    const parentId = getParentForDate(date, pattern, overrides, child)
    if (!parentId) return null
    return { parentId, name: child.parentNames?.[parentId] ?? 'Progenitor', color: child.parentColors?.[parentId] ?? '#6B7280', isMe: parentId === user?.uid }
  }, [child, pattern, overrides, user?.uid])

  if (!child) return (
    <div className="empty-state">
      <div className="empty-state-icon">👶</div>
      <div className="empty-state-title">No hay ningún menor configurado</div>
      <div className="empty-state-sub">Ve a Configuración para añadir un menor</div>
    </div>
  )

  return (
    <div>
      <div className="calendar-month-nav">
        <button className="calendar-nav-btn" onClick={() => setCurrentMonth(subMonths(currentMonth,1))}>‹</button>
        <div>
          <div className="calendar-month-title">{format(currentMonth,'MMMM yyyy',{locale:es})}</div>
          <div className="calendar-legend">
            {child.parents.map(pid => (
              <div key={pid} className="legend-item">
                <div className="legend-dot" style={{background: child.parentColors?.[pid] ?? '#6B7280'}} />
                <span>{child.parentNames?.[pid] ?? 'Progenitor'}{pid===user?.uid?' (tú)':''}</span>
              </div>
            ))}
          </div>
        </div>
        <button className="calendar-nav-btn" onClick={() => setCurrentMonth(addMonths(currentMonth,1))}>›</button>
      </div>

      <div className="day-headers">{DAYS.map(d => <div key={d} className="day-header">{d}</div>)}</div>

      <div className="cal-grid">
        {days.map(date => {
          const inMonth = isSameMonth(date, currentMonth)
          const info = inMonth ? getParentInfo(date) : null
          const todayDay = isToday(date)
          const isOverride = inMonth && overrides.some(o => o.date === toISODate(date))
          return (
            <div key={date.toISOString()}
              className={`cal-cell${!inMonth?' other-month':''}${todayDay?' today':''}`}
              style={info ? { background: info.color+'28', borderColor: info.color+'55' } : { background:'rgba(255,255,255,0.03)', borderColor:'rgba(255,255,255,0.07)' }}
              onClick={() => { if(inMonth){ setSelectedDate(toISODate(date)); setModalOpen(true) } }}
            >
              <div className="cal-day-num">{format(date,'d')}</div>
              {info && <div className="cal-day-name" style={{color:info.color}}>{info.name.split(' ')[0].slice(0,4)}</div>}
              {isOverride && <div className="cal-modified-dot" />}
              {todayDay && <div className="cal-today-dot" />}
            </div>
          )
        })}
      </div>

      <div style={{marginTop:14,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:6,fontSize:11,color:'#6b7280'}}>
          <div style={{width:8,height:8,borderRadius:'50%',background:'#fbbf24'}} />
          Día modificado por acuerdo
        </div>
        <button onClick={() => { setSelectedDate(null); setModalOpen(true) }}
          style={{fontSize:12,color:'#3B82F6',background:'none',border:'none',cursor:'pointer',fontWeight:600}}>
          + Solicitar cambio
        </button>
      </div>

      {modalOpen && <RequestModal open={modalOpen} onClose={() => { setModalOpen(false); setSelectedDate(null) }} initialDate={selectedDate} />}
    </div>
  )
}
