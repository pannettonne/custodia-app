'use client'

import { useState, useMemo } from 'react'
import { parseISO } from 'date-fns'
import { Search, Calendar } from 'lucide-react'
import { useAppStore } from '@/store/app'
import { useAuth } from '@/lib/auth-context'
import { getParentForDate, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

export function QuickDateQuery() {
  const { user } = useAuth()
  const { children, selectedChildId, pattern, overrides } = useAppStore()
  const [date, setDate] = useState('')
  const [queried, setQueried] = useState(false)

  const child = useMemo(
    () => children.find((c) => c.id === selectedChildId) ?? null,
    [children, selectedChildId]
  )

  const result = useMemo(() => {
    if (!queried || !date || !child || !pattern) return null
    const d = parseISO(date)
    const parentId = getParentForDate(d, pattern, overrides, child)
    if (!parentId) return null
    return {
      parentId,
      name: child.parentNames?.[parentId] ?? 'Progenitor',
      color: child.parentColors?.[parentId] ?? '#6B7280',
      isMe: parentId === user?.uid,
    }
  }, [queried, date, child, pattern, overrides, user?.uid])

  const handleQuery = () => {
    if (date) setQueried(true)
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Search size={16} className="text-blue-400" />
        <h3 className="text-sm font-semibold text-slate-300">Consulta rápida de día</h3>
      </div>

      <div className="flex gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value)
            setQueried(false)
          }}
          className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
        />
        <button
          onClick={handleQuery}
          disabled={!date}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium rounded-xl transition-colors"
        >
          Ver
        </button>
      </div>

      {queried && date && (
        <div className="mt-3">
          {result ? (
            <div
              className="flex items-center gap-3 p-3 rounded-xl border"
              style={{
                backgroundColor: result.color + '22',
                borderColor: result.color + '55',
              }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg"
                style={{ backgroundColor: result.color }}
              >
                {result.name[0]?.toUpperCase()}
              </div>
              <div>
                <p className="text-white font-semibold text-sm">
                  {formatDate(date)} → {result.name}
                  {result.isMe && (
                    <span className="ml-2 text-xs bg-white/20 px-2 py-0.5 rounded-full">
                      Tú
                    </span>
                  )}
                </p>
                <p className="text-slate-400 text-xs mt-0.5">
                  {result.isMe ? 'Ese día te corresponde a ti' : `Ese día corresponde a ${result.name}`}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10">
              <Calendar size={16} className="text-slate-500" />
              <p className="text-slate-400 text-sm">No hay patrón configurado para ese día</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
