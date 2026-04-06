'use client'
import { useState, useMemo } from 'react'
import { parseISO } from 'date-fns'
import { useAppStore } from '@/store/app'
import { useAuth } from '@/lib/auth-context'
import { getParentForDate, formatDate } from '@/lib/utils'

export function QuickDateQuery() {
  const { user } = useAuth()
  const { children, selectedChildId, pattern, overrides } = useAppStore()
  const [date, setDate] = useState('')
  const [queried, setQueried] = useState(false)
  const child = useMemo(() => children.find(c => c.id === selectedChildId) ?? null, [children, selectedChildId])

  const result = useMemo(() => {
    if (!queried || !date || !child || !pattern) return null
    const parentId = getParentForDate(parseISO(date), pattern, overrides, child)
    if (!parentId) return null
    return { parentId, name: child.parentNames?.[parentId] ?? 'Progenitor', color: child.parentColors?.[parentId] ?? '#6B7280', isMe: parentId === user?.uid }
  }, [queried, date, child, pattern, overrides, user?.uid])

  return (
    <div className="quick-query">
      <div className="quick-query-title">🔍 Consulta rápida de día</div>
      <div className="quick-row">
        <input type="date" value={date} className="quick-input"
          onChange={e => { setDate(e.target.value); setQueried(false) }} />
        <button className="quick-btn" disabled={!date} onClick={() => setQueried(true)}>Ver</button>
      </div>
      {queried && date && (
        result ? (
          <div className="quick-result" style={{background: result.color+'18', borderColor: result.color+'44'}}>
            <div className="quick-result-avatar" style={{background: result.color}}>{result.name[0]?.toUpperCase()}</div>
            <div>
              <div className="quick-result-name">
                {formatDate(date)} → {result.name}
                {result.isMe && <span style={{marginLeft:8,fontSize:10,background:'rgba(255,255,255,0.15)',padding:'2px 7px',borderRadius:6}}>Tú</span>}
              </div>
              <div className="quick-result-sub">{result.isMe ? 'Ese día te corresponde a ti' : `Ese día corresponde a ${result.name}`}</div>
            </div>
          </div>
        ) : (
          <div className="quick-result" style={{background:'rgba(255,255,255,0.04)',borderColor:'rgba(255,255,255,0.1)'}}>
            <div style={{color:'#6b7280',fontSize:13}}>No hay patrón configurado para ese día</div>
          </div>
        )
      )}
    </div>
  )
}
