'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  format,
  parseISO,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useAppStore } from '@/store/app'
import { useAuth } from '@/lib/auth-context'
import { getParentForDate, toISODate, cn } from '@/lib/utils'
import { RequestModal } from '@/components/requests/RequestModal'

const DAYS_ES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export function CustodyCalendar() {
  const { user } = useAuth()
  const { currentMonth, setCurrentMonth, children, selectedChildId, pattern, overrides } =
    useAppStore()

  const [requestModalOpen, setRequestModalOpen] = useState(false)
  const [selectedDateForRequest, setSelectedDateForRequest] = useState<string | null>(null)

  const child = useMemo(
    () => children.find((c) => c.id === selectedChildId) ?? null,
    [children, selectedChildId]
  )

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 })
    const result: Date[] = []
    let cur = start
    while (cur <= end) {
      result.push(cur)
      cur = addDays(cur, 1)
    }
    return result
  }, [currentMonth])

  const getParentInfo = useCallback(
    (date: Date) => {
      if (!child || !pattern) return null
      const parentId = getParentForDate(date, pattern, overrides, child)
      if (!parentId) return null
      return {
        parentId,
        name: child.parentNames?.[parentId] ?? 'Progenitor',
        color: child.parentColors?.[parentId] ?? '#6B7280',
        isMe: parentId === user?.uid,
      }
    },
    [child, pattern, overrides, user?.uid]
  )

  const handleDayClick = (date: Date) => {
    if (!isSameMonth(date, currentMonth)) return
    setSelectedDateForRequest(toISODate(date))
    setRequestModalOpen(true)
  }

  if (!child) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="text-6xl mb-4">👶</div>
        <p className="text-slate-400 text-lg">No hay ningún menor configurado</p>
        <p className="text-slate-500 text-sm mt-2">
          Ve a Configuración para añadir un menor
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header del calendario */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="p-2 rounded-xl hover:bg-white/10 transition-colors text-slate-300 hover:text-white"
        >
          <ChevronLeft size={20} />
        </button>

        <div className="text-center">
          <h2 className="text-xl font-bold text-white capitalize">
            {format(currentMonth, 'MMMM yyyy', { locale: es })}
          </h2>
          <div className="flex gap-3 mt-2 justify-center">
            {child.parents.map((pid) => (
              <div key={pid} className="flex items-center gap-1.5">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: child.parentColors?.[pid] ?? '#6B7280' }}
                />
                <span className="text-xs text-slate-400">
                  {child.parentNames?.[pid] ?? 'Progenitor'}
                  {pid === user?.uid ? ' (tú)' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="p-2 rounded-xl hover:bg-white/10 transition-colors text-slate-300 hover:text-white"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Cabeceras días semana */}
      <div className="grid grid-cols-7 mb-2">
        {DAYS_ES.map((d) => (
          <div key={d} className="text-center text-xs font-semibold text-slate-500 py-2">
            {d}
          </div>
        ))}
      </div>

      {/* Grid del calendario */}
      <div className="grid grid-cols-7 gap-1 flex-1">
        {days.map((date) => {
          const inMonth = isSameMonth(date, currentMonth)
          const todayDay = isToday(date)
          const parentInfo = inMonth ? getParentInfo(date) : null
          const isOverride = inMonth && overrides.some((o) => o.date === toISODate(date))

          return (
            <button
              key={date.toISOString()}
              onClick={() => handleDayClick(date)}
              disabled={!inMonth}
              className={cn(
                'relative flex flex-col items-center justify-start pt-1.5 pb-1 rounded-xl transition-all min-h-[52px] group',
                inMonth ? 'cursor-pointer hover:scale-105' : 'opacity-20 cursor-default',
                todayDay && 'ring-2 ring-white/40'
              )}
              style={
                parentInfo
                  ? {
                      backgroundColor: parentInfo.color + '33',
                      borderColor: parentInfo.color + '66',
                      border: '1px solid',
                    }
                  : {
                      backgroundColor: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }
              }
            >
              <span
                className={cn(
                  'text-sm font-semibold leading-none',
                  todayDay ? 'text-white' : inMonth ? 'text-slate-200' : 'text-slate-600'
                )}
              >
                {format(date, 'd')}
              </span>

              {parentInfo && (
                <span
                  className="text-[9px] font-bold mt-1 leading-none truncate max-w-full px-1"
                  style={{ color: parentInfo.color }}
                >
                  {parentInfo.name.split(' ')[0]}
                </span>
              )}

              {isOverride && (
                <div
                  className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-yellow-400"
                  title="Día modificado"
                />
              )}

              {todayDay && (
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white" />
              )}
            </button>
          )
        })}
      </div>

      {/* Leyenda inferior */}
      <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-yellow-400" />
          <span>Día modificado por acuerdo</span>
        </div>
        <button
          onClick={() => {
            setSelectedDateForRequest(null)
            setRequestModalOpen(true)
          }}
          className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
        >
          <Plus size={14} />
          <span>Solicitar cambio</span>
        </button>
      </div>

      {/* Modal de solicitud */}
      {requestModalOpen && (
        <RequestModal
          open={requestModalOpen}
          onClose={() => {
            setRequestModalOpen(false)
            setSelectedDateForRequest(null)
          }}
          initialDate={selectedDateForRequest}
        />
      )}
    </div>
  )
}
