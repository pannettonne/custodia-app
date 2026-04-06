'use client'
import { useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { getParentForDate, toISODate } from '@/lib/utils'
import { eachDayOfInterval, startOfMonth, endOfMonth, startOfYear, endOfYear, parseISO, subMonths, format } from 'date-fns'
import { es } from 'date-fns/locale'

type Period = 'month' | 'year' | '3months'

export function StatsPanel() {
  const { user } = useAuth()
  const { children, selectedChildId, pattern, overrides, requests } = useAppStore()
  const [period, setPeriod] = useState<Period>('month')
  const child = useMemo(() => children.find(c => c.id === selectedChildId) ?? null, [children, selectedChildId])

  const { dateRange, label } = useMemo(() => {
    const today = new Date()
    if (period === 'month') return { dateRange: { start: startOfMonth(today), end: endOfMonth(today) }, label: format(today, 'MMMM yyyy', { locale: es }) }
    if (period === '3months') return { dateRange: { start: startOfMonth(subMonths(today, 2)), end: endOfMonth(today) }, label: 'Últimos 3 meses' }
    return { dateRange: { start: startOfYear(today), end: endOfYear(today) }, label: `Año ${today.getFullYear()}` }
  }, [period])

  const stats = useMemo(() => {
    if (!child || !pattern) return null
    const days = eachDayOfInterval(dateRange)
    const counts: Record<string, number> = {}
    child.parents.forEach(p => { counts[p] = 0 })

    for (const day of days) {
      const pid = getParentForDate(day, pattern, overrides, child)
      if (pid) counts[pid] = (counts[pid] ?? 0) + 1
    }

    const total = Object.values(counts).reduce((a, b) => a + b, 0)
    return { counts, total }
  }, [child, pattern, overrides, dateRange])

  const requestStats = useMemo(() => ({
    total: requests.length,
    accepted: requests.filter(r => r.status === 'accepted').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
    pending: requests.filter(r => r.status === 'pending').length,
    sentByMe: requests.filter(r => r.fromParentId === user?.uid).length,
    receivedByMe: requests.filter(r => r.toParentId === user?.uid).length,
  }), [requests, user?.uid])

  const monthlyBreakdown = useMemo(() => {
    if (!child || !pattern) return []
    const today = new Date()
    return Array.from({ length: 4 }, (_, i) => {
      const month = subMonths(today, 3 - i)
      const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) })
      const counts: Record<string, number> = {}
      child.parents.forEach(p => { counts[p] = 0 })
      for (const day of days) {
        const pid = getParentForDate(day, pattern, overrides, child)
        if (pid) counts[pid] = (counts[pid] ?? 0) + 1
      }
      return { month: format(month, 'MMM', { locale: es }), counts, total: days.length }
    })
  }, [child, pattern, overrides])

  if (!child || !pattern) return (
    <div className="empty-state">
      <div className="empty-state-icon">📊</div>
      <div className="empty-state-title">Sin datos todavía</div>
      <div className="empty-state-sub">Configura el patrón de custodia para ver estadísticas</div>
    </div>
  )

  return (
    <div>
      <div className="page-title">Estadísticas</div>

      {/* Period selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {([['month', 'Este mes'], ['3months', '3 meses'], ['year', 'Este año']] as [Period, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setPeriod(k)}
            style={{ flex: 1, padding: '8px 4px', borderRadius: 10, border: `1px solid ${period===k ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)'}`, background: period===k ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)', color: period===k ? '#fff' : '#9ca3af', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {l}
          </button>
        ))}
      </div>

      {/* Main donut-style breakdown */}
      {stats && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', marginBottom: 14, textTransform: 'capitalize' }}>📅 {label}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* Bar visual */}
            <div style={{ flex: 1, height: 16, borderRadius: 8, overflow: 'hidden', display: 'flex' }}>
              {child.parents.map((pid, i) => {
                const pct = stats.total > 0 ? ((stats.counts[pid] ?? 0) / stats.total) * 100 : 50
                return <div key={pid} style={{ width: `${pct}%`, background: child.parentColors?.[pid] ?? '#6b7280', transition: 'width 0.5s' }} />
              })}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginTop: 16 }}>
            {child.parents.map(pid => {
              const days = stats.counts[pid] ?? 0
              const pct = stats.total > 0 ? Math.round((days / stats.total) * 100) : 0
              const color = child.parentColors?.[pid] ?? '#6b7280'
              const isMe = pid === user?.uid
              return (
                <div key={pid} style={{ background: color + '15', border: `1px solid ${color}30`, borderRadius: 14, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
                    <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>{child.parentNames?.[pid] ?? 'Progenitor'}{isMe ? ' (tú)' : ''}</span>
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{days}</div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>días · {pct}%</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Monthly trend bars */}
      {monthlyBreakdown.length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', marginBottom: 14 }}>📈 Tendencia últimos 4 meses</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 80 }}>
            {monthlyBreakdown.map(({ month, counts, total }) => (
              <div key={month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1, height: 60, justifyContent: 'flex-end' }}>
                  {child.parents.map(pid => {
                    const pct = total > 0 ? ((counts[pid] ?? 0) / total) * 100 : 50
                    return <div key={pid} style={{ width: '100%', height: `${pct * 0.6}%`, background: child.parentColors?.[pid] ?? '#6b7280', borderRadius: 3, minHeight: 2 }} />
                  })}
                </div>
                <span style={{ fontSize: 10, color: '#6b7280', textTransform: 'capitalize' }}>{month}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
            {child.parents.map(pid => (
              <div key={pid} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: child.parentColors?.[pid] ?? '#6b7280' }} />
                <span style={{ fontSize: 10, color: '#9ca3af' }}>{child.parentNames?.[pid]?.split(' ')[0]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Request stats */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', marginBottom: 14 }}>🔄 Solicitudes de cambio (total)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[
            { label: 'Pendientes', value: requestStats.pending, color: '#f59e0b' },
            { label: 'Aceptadas',  value: requestStats.accepted, color: '#10b981' },
            { label: 'Rechazadas', value: requestStats.rejected, color: '#ef4444' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: color + '12', border: `1px solid ${color}25`, borderRadius: 12, padding: '10px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
              <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#e5e7eb' }}>{requestStats.sentByMe}</div>
            <div style={{ fontSize: 10, color: '#6b7280' }}>enviadas por ti</div>
          </div>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#e5e7eb' }}>{requestStats.receivedByMe}</div>
            <div style={{ fontSize: 10, color: '#6b7280' }}>recibidas por ti</div>
          </div>
        </div>
      </div>
    </div>
  )
}
