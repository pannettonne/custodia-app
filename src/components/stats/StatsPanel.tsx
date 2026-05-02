'use client'
import { useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { getParentForDate } from '@/lib/utils'
import {
  eachDayOfInterval,
  endOfMonth,
  endOfYear,
  format,
  parseISO,
  startOfMonth,
  startOfYear,
  subMonths,
  addMonths,
} from 'date-fns'
import { es } from 'date-fns/locale'

type Period = 'month' | '3months' | 'year'

function toDateKey(date: Date) {
  return format(date, 'yyyy-MM-dd')
}

function intersectsDateRange(startDate?: string, endDate?: string, rangeStart?: string, rangeEnd?: string) {
  if (!startDate || !rangeStart || !rangeEnd) return false
  const start = startDate
  const end = endDate || startDate
  return start <= rangeEnd && end >= rangeStart
}

function StatCard({ label, value, helper, color = 'var(--text-strong)' }: { label: string; value: string | number; helper?: string; color?: string }) {
  return (
    <div className="card" style={{ padding: 14, borderRadius: 18, background: 'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-soft) 100%)' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1.05, marginTop: 8 }}>{value}</div>
      {helper ? <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>{helper}</div> : null}
    </div>
  )
}

function MiniMetric({ label, value, tone = 'neutral' }: { label: string; value: string | number; tone?: 'neutral' | 'warning' | 'success' | 'danger' | 'info' | 'violet' }) {
  const palette =
    tone === 'warning' ? { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.22)', color: '#f59e0b' } :
    tone === 'success' ? { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.22)', color: '#10b981' } :
    tone === 'danger' ? { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.22)', color: '#ef4444' } :
    tone === 'info' ? { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.22)', color: '#60a5fa' } :
    tone === 'violet' ? { bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.22)', color: '#8B5CF6' } :
    { bg: 'var(--bg-soft)', border: 'var(--border)', color: 'var(--text-secondary)' }

  return (
    <div style={{ background: palette.bg, border: `1px solid ${palette.border}`, borderRadius: 14, padding: '10px 12px' }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: palette.color, marginTop: 4 }}>{value}</div>
    </div>
  )
}

export function StatsPanel() {
  const { user } = useAuth()
  const {
    children,
    selectedChildId,
    pattern,
    overrides,
    requests,
    specialPeriods,
    events,
    notes,
    collaboratorAssignments,
    medicationLogs,
    availabilityBlocks,
  } = useAppStore()

  const [period, setPeriod] = useState<Period>('month')
  const [anchorMonth, setAnchorMonth] = useState(() => format(new Date(), 'yyyy-MM'))
  const child = useMemo(() => children.find(c => c.id === selectedChildId) ?? null, [children, selectedChildId])

  const anchorDate = useMemo(() => parseISO(`${anchorMonth}-01`), [anchorMonth])

  const { dateRange, label, rangeStartKey, rangeEndKey } = useMemo(() => {
    if (period === 'month') {
      const start = startOfMonth(anchorDate)
      const end = endOfMonth(anchorDate)
      return {
        dateRange: { start, end },
        label: format(anchorDate, 'MMMM yyyy', { locale: es }),
        rangeStartKey: toDateKey(start),
        rangeEndKey: toDateKey(end),
      }
    }
    if (period === '3months') {
      const start = startOfMonth(subMonths(anchorDate, 2))
      const end = endOfMonth(anchorDate)
      return {
        dateRange: { start, end },
        label: `${format(start, 'MMM yyyy', { locale: es })} → ${format(end, 'MMM yyyy', { locale: es })}`,
        rangeStartKey: toDateKey(start),
        rangeEndKey: toDateKey(end),
      }
    }
    const start = startOfYear(anchorDate)
    const end = endOfYear(anchorDate)
    return {
      dateRange: { start, end },
      label: `Año ${format(anchorDate, 'yyyy')}`,
      rangeStartKey: toDateKey(start),
      rangeEndKey: toDateKey(end),
    }
  }, [anchorDate, period])

  const stats = useMemo(() => {
    if (!child || !pattern) return null
    const days = eachDayOfInterval(dateRange)
    const counts: Record<string, number> = {}
    child.parents.forEach(parentId => { counts[parentId] = 0 })

    for (const day of days) {
      const pid = getParentForDate(day, pattern, overrides, child, specialPeriods)
      if (pid) counts[pid] = (counts[pid] ?? 0) + 1
    }

    const total = Object.values(counts).reduce((a, b) => a + b, 0)
    const imbalance = child.parents.length >= 2 ? Math.abs((counts[child.parents[0]] ?? 0) - (counts[child.parents[1]] ?? 0)) : 0
    const percentageByParent = Object.fromEntries(child.parents.map(pid => [pid, total > 0 ? Math.round(((counts[pid] ?? 0) / total) * 100) : 0]))
    return { counts, total, imbalance, percentageByParent }
  }, [child, pattern, overrides, specialPeriods, dateRange])

  const requestStats = useMemo(() => {
    const filtered = requests.filter(req => req.childId === child?.id && intersectsDateRange(req.type === 'single' ? req.date : req.startDate, req.type === 'single' ? req.date : req.endDate, rangeStartKey, rangeEndKey))
    return {
      total: filtered.length,
      accepted: filtered.filter(r => r.status === 'accepted').length,
      rejected: filtered.filter(r => r.status === 'rejected').length,
      pending: filtered.filter(r => r.status === 'pending').length,
      cancelled: filtered.filter(r => r.status === 'cancelled').length,
      sentByMe: filtered.filter(r => r.fromParentId === user?.uid).length,
      receivedByMe: filtered.filter(r => r.toParentId === user?.uid).length,
    }
  }, [requests, child?.id, rangeStartKey, rangeEndKey, user?.uid])

  const eventStats = useMemo(() => {
    const filtered = events.filter(event => event.childId === child?.id && intersectsDateRange(event.date, event.endDate, rangeStartKey, rangeEndKey))
    return {
      total: filtered.length,
      allDay: filtered.filter(event => event.allDay).length,
      timed: filtered.filter(event => !event.allDay).length,
      assigned: filtered.filter(event => !!event.assignedParentId).length,
      reminders: filtered.filter(event => event.reminderEnabled).length,
    }
  }, [events, child?.id, rangeStartKey, rangeEndKey])

  const noteStats = useMemo(() => {
    const filtered = notes.filter(note => note.childId === child?.id && intersectsDateRange(note.date || note.startDate, note.endDate || note.date || note.startDate, rangeStartKey, rangeEndKey))
    return {
      total: filtered.length,
      important: filtered.filter(note => note.tag === 'importante').length,
      urgent: filtered.filter(note => note.tag === 'urgente').length,
      unreadForMe: filtered.filter(note => !note.read && note.createdBy !== user?.uid).length,
    }
  }, [notes, child?.id, rangeStartKey, rangeEndKey, user?.uid])

  const collaboratorStats = useMemo(() => {
    const filtered = collaboratorAssignments.filter(item => item.childId === child?.id && item.date >= rangeStartKey && item.date <= rangeEndKey)
    return {
      total: filtered.length,
      pending: filtered.filter(item => item.status === 'pending').length,
      accepted: filtered.filter(item => item.status === 'accepted').length,
      rejected: filtered.filter(item => item.status === 'rejected').length,
      cancelled: filtered.filter(item => item.status === 'cancelled').length,
    }
  }, [collaboratorAssignments, child?.id, rangeStartKey, rangeEndKey])

  const medicationStats = useMemo(() => {
    const filtered = medicationLogs.filter(log => log.childId === child?.id && log.scheduledDate >= rangeStartKey && log.scheduledDate <= rangeEndKey)
    const administered = filtered.filter(log => log.status === 'administered').length
    const skipped = filtered.filter(log => log.status === 'skipped').length
    const total = filtered.length
    return {
      total,
      administered,
      skipped,
      adherence: total > 0 ? Math.round((administered / total) * 100) : 0,
    }
  }, [medicationLogs, child?.id, rangeStartKey, rangeEndKey])

  const custodyAdjustments = useMemo(() => {
    const childOverrides = overrides.filter(item => item.childId === child?.id && item.date >= rangeStartKey && item.date <= rangeEndKey)
    const childBlocks = availabilityBlocks.filter(item => item.childId === child?.id && intersectsDateRange(item.date || item.startDate, item.endDate || item.date || item.startDate, rangeStartKey, rangeEndKey))
    return {
      overrides: childOverrides.length,
      blockedPeriods: childBlocks.length,
    }
  }, [overrides, availabilityBlocks, child?.id, rangeStartKey, rangeEndKey])

  const monthlyBreakdown = useMemo(() => {
    if (!child || !pattern) return []
    return Array.from({ length: 6 }, (_, index) => {
      const month = subMonths(anchorDate, 5 - index)
      const start = startOfMonth(month)
      const end = endOfMonth(month)
      const days = eachDayOfInterval({ start, end })
      const counts: Record<string, number> = {}
      child.parents.forEach(parentId => { counts[parentId] = 0 })
      for (const day of days) {
        const pid = getParentForDate(day, pattern, overrides, child, specialPeriods)
        if (pid) counts[pid] = (counts[pid] ?? 0) + 1
      }
      return {
        key: format(month, 'yyyy-MM'),
        monthLabel: format(month, 'MMM', { locale: es }),
        caption: format(month, 'MMMM yyyy', { locale: es }),
        counts,
        total: days.length,
      }
    })
  }, [anchorDate, child, pattern, overrides, specialPeriods])

  if (!child || !pattern) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📊</div>
        <div className="empty-state-title">Sin datos todavía</div>
        <div className="empty-state-sub">Configura el patrón de custodia para ver estadísticas</div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-title">Estadísticas</div>

      <div className="card" style={{ marginBottom: 14, padding: 14, borderRadius: 20, background: 'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-soft) 100%)' }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {([['month', 'Mes'], ['3months', '3 meses'], ['year', 'Año']] as [Period, string][]).map(([value, text]) => (
            <button
              key={value}
              onClick={() => setPeriod(value)}
              style={{
                flex: 1,
                padding: '9px 6px',
                borderRadius: 12,
                border: `1px solid ${period === value ? 'var(--text-strong)' : 'var(--border)'}`,
                background: period === value ? 'var(--bg-card)' : 'var(--bg-soft)',
                color: period === value ? 'var(--text-strong)' : 'var(--text-secondary)',
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {text}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 40px', gap: 8, alignItems: 'center', marginBottom: 10 }}>
          <button onClick={() => setAnchorMonth(format(subMonths(anchorDate, 1), 'yyyy-MM'))} style={{ height: 40, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-soft)', color: 'var(--text-secondary)', fontSize: 18, cursor: 'pointer' }}>‹</button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-strong)', textTransform: 'capitalize' }}>{label}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>Ancla temporal de la vista</div>
          </div>
          <button onClick={() => setAnchorMonth(format(addMonths(anchorDate, 1), 'yyyy-MM'))} style={{ height: 40, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-soft)', color: 'var(--text-secondary)', fontSize: 18, cursor: 'pointer' }}>›</button>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <input type="month" value={anchorMonth} onChange={e => setAnchorMonth(e.target.value)} className="settings-input" style={{ marginBottom: 0 }} />
          <button onClick={() => setAnchorMonth(format(new Date(), 'yyyy-MM'))} className="btn-primary btn-outline" style={{ whiteSpace: 'nowrap' }}>Hoy</button>
        </div>
      </div>

      {stats ? (
        <div className="card" style={{ marginBottom: 12, padding: 16, borderRadius: 20, background: 'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-soft) 100%)' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.35 }}>Custodia en {label}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, height: 18, borderRadius: 999, overflow: 'hidden', display: 'flex', background: 'var(--bg-soft)' }}>
              {child.parents.map(parentId => {
                const pct = stats.total > 0 ? ((stats.counts[parentId] ?? 0) / stats.total) * 100 : 50
                return <div key={parentId} style={{ width: `${pct}%`, background: child.parentColors?.[parentId] ?? '#6b7280', transition: 'width 0.4s ease' }} />
              })}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginTop: 16 }}>
            {child.parents.map(parentId => {
              const days = stats.counts[parentId] ?? 0
              const pct = stats.percentageByParent[parentId] ?? 0
              const color = child.parentColors?.[parentId] ?? '#6b7280'
              const isMe = parentId === user?.uid
              return (
                <div key={parentId} style={{ background: `${color}12`, border: `1px solid ${color}26`, borderRadius: 16, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700 }}>{child.parentNames?.[parentId] ?? 'Progenitor'}{isMe ? ' (tú)' : ''}</span>
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1 }}>{days}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{pct}% del periodo</div>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 12 }}>
        <StatCard label="Días analizados" value={stats?.total ?? 0} helper={label} />
        <StatCard label="Diferencia entre progenitores" value={stats?.imbalance ?? 0} helper="0 significa reparto perfecto" color="#f59e0b" />
      </div>

      <div className="card" style={{ marginBottom: 12, padding: 16, borderRadius: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.35 }}>Tendencia de custodia · últimos 6 meses</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 96 }}>
          {monthlyBreakdown.map(({ key, monthLabel, caption, counts, total }) => (
            <div key={key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div title={caption} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2, height: 72, justifyContent: 'flex-end' }}>
                {child.parents.map(parentId => {
                  const pct = total > 0 ? ((counts[parentId] ?? 0) / total) * 100 : 0
                  return <div key={parentId} style={{ width: '100%', height: `${Math.max(4, pct * 0.72)}%`, background: child.parentColors?.[parentId] ?? '#6b7280', borderRadius: 4 }} />
                })}
              </div>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{monthLabel}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12, padding: 16, borderRadius: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.35 }}>Actividad del periodo</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          <MiniMetric label="Solicitudes" value={requestStats.total} tone="warning" />
          <MiniMetric label="Eventos" value={eventStats.total} tone="info" />
          <MiniMetric label="Notas" value={noteStats.total} tone="neutral" />
          <MiniMetric label="Asignaciones colab." value={collaboratorStats.total} tone="violet" />
          <MiniMetric label="Tomas registradas" value={medicationStats.total} tone="success" />
          <MiniMetric label="Ajustes de custodia" value={custodyAdjustments.overrides} tone="danger" />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12, padding: 16, borderRadius: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.35 }}>Detalle de solicitudes</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
          <MiniMetric label="Pendientes" value={requestStats.pending} tone="warning" />
          <MiniMetric label="Aceptadas" value={requestStats.accepted} tone="success" />
          <MiniMetric label="Rechazadas" value={requestStats.rejected} tone="danger" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <MiniMetric label="Canceladas" value={requestStats.cancelled} />
          <MiniMetric label="Enviadas por ti" value={requestStats.sentByMe} tone="info" />
          <MiniMetric label="Recibidas por ti" value={requestStats.receivedByMe} tone="violet" />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12, padding: 16, borderRadius: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.35 }}>Eventos y notas</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 10 }}>
          <MiniMetric label="Eventos con hora" value={eventStats.timed} tone="info" />
          <MiniMetric label="Eventos todo el día" value={eventStats.allDay} tone="info" />
          <MiniMetric label="Eventos asignados" value={eventStats.assigned} tone="warning" />
          <MiniMetric label="Con recordatorio" value={eventStats.reminders} tone="success" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <MiniMetric label="Notas importantes" value={noteStats.important} tone="warning" />
          <MiniMetric label="Notas urgentes" value={noteStats.urgent} tone="danger" />
          <MiniMetric label="Sin leer" value={noteStats.unreadForMe} tone="neutral" />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12, padding: 16, borderRadius: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.35 }}>Colaboradores y medicación</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 10 }}>
          <MiniMetric label="Pendientes colab." value={collaboratorStats.pending} tone="violet" />
          <MiniMetric label="Aceptadas colab." value={collaboratorStats.accepted} tone="success" />
          <MiniMetric label="Rechazadas colab." value={collaboratorStats.rejected} tone="danger" />
          <MiniMetric label="Canceladas colab." value={collaboratorStats.cancelled} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <MiniMetric label="Administradas" value={medicationStats.administered} tone="success" />
          <MiniMetric label="Omitidas" value={medicationStats.skipped} tone="danger" />
          <MiniMetric label="Adherencia" value={`${medicationStats.adherence}%`} tone="info" />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12, padding: 16, borderRadius: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.35 }}>Bloqueos y ajustes</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          <MiniMetric label="Overrides de custodia" value={custodyAdjustments.overrides} tone="danger" />
          <MiniMetric label="Bloqueos registrados" value={custodyAdjustments.blockedPeriods} tone="warning" />
        </div>
      </div>
    </div>
  )
}
