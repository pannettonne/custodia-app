'use client'
import { useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { getParentForDate } from '@/lib/utils'
import {
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfYear,
  format,
  getDay,
  max,
  min,
  parseISO,
  startOfMonth,
  startOfYear,
  subMonths,
} from 'date-fns'
import { es } from 'date-fns/locale'

type Period = 'month' | 'year' | '3months'

type DateRange = { start: Date; end: Date }

function overlapsRange(startDate?: string, endDate?: string, range?: DateRange) {
  if (!startDate || !range) return false
  const start = parseISO(startDate)
  const end = parseISO(endDate || startDate)
  return start <= range.end && end >= range.start
}

function dateInRange(date?: string, range?: DateRange) {
  if (!date || !range) return false
  const value = parseISO(date)
  return value >= range.start && value <= range.end
}

function overlapDays(startDate?: string, endDate?: string, range?: DateRange) {
  if (!startDate || !range) return 0
  const start = parseISO(startDate)
  const end = parseISO(endDate || startDate)
  if (start > range.end || end < range.start) return 0
  const overlapStart = max([start, range.start])
  const overlapEnd = min([end, range.end])
  return differenceInCalendarDays(overlapEnd, overlapStart) + 1
}

function metricTone(color: string) {
  return {
    background: `${color}14`,
    border: `1px solid ${color}28`,
    color,
  }
}

function MetricCard({ label, value, helper, color }: { label: string; value: string | number; helper?: string; color: string }) {
  const tone = metricTone(color)
  return (
    <div style={{ ...tone, borderRadius: 16, padding: '12px 12px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1, color }}>{value}</div>
      {helper ? <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>{helper}</div> : null}
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
    availabilityBlocks,
    medications,
    medicationLogs,
    contacts,
    documents,
    packingItems,
  } = useAppStore()

  const [period, setPeriod] = useState<Period>('month')
  const [anchorMonth, setAnchorMonth] = useState(format(new Date(), 'yyyy-MM'))
  const child = useMemo(() => children.find(c => c.id === selectedChildId) ?? null, [children, selectedChildId])
  const anchorDate = useMemo(() => parseISO(`${anchorMonth}-01`), [anchorMonth])

  const { dateRange, label } = useMemo(() => {
    if (period === 'month') {
      return {
        dateRange: { start: startOfMonth(anchorDate), end: endOfMonth(anchorDate) },
        label: format(anchorDate, 'MMMM yyyy', { locale: es }),
      }
    }
    if (period === '3months') {
      return {
        dateRange: { start: startOfMonth(subMonths(anchorDate, 2)), end: endOfMonth(anchorDate) },
        label: `${format(subMonths(anchorDate, 2), 'MMM yyyy', { locale: es })} · ${format(anchorDate, 'MMM yyyy', { locale: es })}`,
      }
    }
    return {
      dateRange: { start: startOfYear(anchorDate), end: endOfYear(anchorDate) },
      label: `Año ${format(anchorDate, 'yyyy')}`,
    }
  }, [anchorDate, period])

  const shiftAnchor = (direction: -1 | 1) => {
    const step = period === 'year' ? 12 : 1
    setAnchorMonth(format(addMonths(anchorDate, direction * step), 'yyyy-MM'))
  }

  const stats = useMemo(() => {
    if (!child || !pattern) return null

    const days = eachDayOfInterval(dateRange)
    const custodyCounts: Record<string, number> = {}
    const weekendCounts: Record<string, number> = {}
    child.parents.forEach(pid => {
      custodyCounts[pid] = 0
      weekendCounts[pid] = 0
    })

    for (const day of days) {
      const pid = getParentForDate(day, pattern, overrides, child, specialPeriods)
      if (pid) {
        custodyCounts[pid] = (custodyCounts[pid] ?? 0) + 1
        const weekday = getDay(day)
        if (weekday === 0 || weekday === 6) weekendCounts[pid] = (weekendCounts[pid] ?? 0) + 1
      }
    }

    const childRequests = requests.filter(r => r.childId === child.id && overlapsRange(r.type === 'single' ? r.date : r.startDate, r.type === 'single' ? r.date : r.endDate, dateRange))
    const childEvents = events.filter(e => e.childId === child.id && overlapsRange(e.date, e.endDate, dateRange))
    const childNotes = notes.filter(n => n.childId === child.id && overlapsRange(n.type === 'single' ? n.date : n.startDate, n.type === 'single' ? n.date : n.endDate, dateRange))
    const childAssignments = collaboratorAssignments.filter(a => a.childId === child.id && dateInRange(a.date, dateRange))
    const childBlocks = availabilityBlocks.filter(b => b.childId === child.id && overlapsRange(b.date || b.startDate, b.date || b.endDate, dateRange))
    const childOverrides = overrides.filter(o => o.childId === child.id && dateInRange(o.date, dateRange))
    const childSpecialPeriods = specialPeriods.filter(s => s.childId === child.id && overlapsRange(s.startDate, s.endDate, dateRange))
    const childMedications = medications.filter(m => m.childId === child.id && overlapsRange(m.startDate, m.endDate, dateRange))
    const childMedicationLogs = medicationLogs.filter(l => l.childId === child.id && dateInRange(l.scheduledDate, dateRange))
    const childContacts = contacts.filter(c => c.childIds?.includes(child.id))
    const childDocuments = documents.filter(d => d.childId === child.id)
    const childPackingItems = packingItems.filter(p => p.childId === child.id)

    const requestBreakdown = {
      total: childRequests.length,
      pending: childRequests.filter(r => r.status === 'pending').length,
      accepted: childRequests.filter(r => r.status === 'accepted').length,
      rejected: childRequests.filter(r => r.status === 'rejected').length,
      sentByMe: childRequests.filter(r => r.fromParentId === user?.uid).length,
      receivedByMe: childRequests.filter(r => r.toParentId === user?.uid).length,
    }

    const collaboratorBreakdown = {
      total: childAssignments.length,
      pending: childAssignments.filter(a => a.status === 'pending').length,
      accepted: childAssignments.filter(a => a.status === 'accepted').length,
      rejected: childAssignments.filter(a => a.status === 'rejected').length,
      cancelled: childAssignments.filter(a => a.status === 'cancelled').length,
    }

    const medicationBreakdown = {
      activePlans: childMedications.filter(m => m.status === 'active').length,
      totalLogs: childMedicationLogs.length,
      administered: childMedicationLogs.filter(l => l.status === 'administered').length,
      skipped: childMedicationLogs.filter(l => l.status === 'skipped').length,
    }

    const specialPeriodDays = childSpecialPeriods.reduce((sum, item) => sum + overlapDays(item.startDate, item.endDate, dateRange), 0)
    const timedEvents = childEvents.filter(e => !e.allDay).length
    const fullDayEvents = childEvents.filter(e => e.allDay).length
    const noteMentions = childNotes.filter(n => n.mentionOther).length
    const totalCustodyDays = Object.values(custodyCounts).reduce((acc, value) => acc + value, 0)
    const weekendDays = Object.values(weekendCounts).reduce((acc, value) => acc + value, 0)

    return {
      custodyCounts,
      weekendCounts,
      totalCustodyDays,
      weekendDays,
      requestBreakdown,
      collaboratorBreakdown,
      medicationBreakdown,
      totals: {
        events: childEvents.length,
        fullDayEvents,
        timedEvents,
        notes: childNotes.length,
        noteMentions,
        overrides: childOverrides.length,
        blocks: childBlocks.length,
        specialPeriods: childSpecialPeriods.length,
        specialPeriodDays,
        contacts: childContacts.length,
        documents: childDocuments.length,
        packingItems: childPackingItems.length,
      },
    }
  }, [
    availabilityBlocks,
    child,
    collaboratorAssignments,
    dateRange,
    documents,
    events,
    medicationLogs,
    medications,
    notes,
    overrides,
    packingItems,
    pattern,
    requests,
    specialPeriods,
    user?.uid,
    contacts,
  ])

  const monthlyBreakdown = useMemo(() => {
    if (!child || !pattern) return []
    return Array.from({ length: 6 }, (_, index) => {
      const monthDate = subMonths(anchorDate, 5 - index)
      const range = { start: startOfMonth(monthDate), end: endOfMonth(monthDate) }
      const days = eachDayOfInterval(range)
      const counts: Record<string, number> = {}
      child.parents.forEach(pid => { counts[pid] = 0 })
      for (const day of days) {
        const pid = getParentForDate(day, pattern, overrides, child, specialPeriods)
        if (pid) counts[pid] = (counts[pid] ?? 0) + 1
      }
      const eventCount = events.filter(e => e.childId === child.id && overlapsRange(e.date, e.endDate, range)).length
      const requestCount = requests.filter(r => r.childId === child.id && overlapsRange(r.type === 'single' ? r.date : r.startDate, r.type === 'single' ? r.date : r.endDate, range)).length
      return {
        month: format(monthDate, 'MMM', { locale: es }),
        counts,
        total: days.length,
        events: eventCount,
        requests: requestCount,
      }
    })
  }, [anchorDate, child, events, overrides, pattern, requests, specialPeriods])

  if (!child || !pattern || !stats) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📊</div>
        <div className="empty-state-title">Sin datos todavía</div>
        <div className="empty-state-sub">Configura el patrón de custodia para ver estadísticas</div>
      </div>
    )
  }

  const adherence = stats.medicationBreakdown.totalLogs > 0
    ? Math.round((stats.medicationBreakdown.administered / stats.medicationBreakdown.totalLogs) * 100)
    : 0
  const acceptanceRate = stats.requestBreakdown.total > 0
    ? Math.round((stats.requestBreakdown.accepted / stats.requestBreakdown.total) * 100)
    : 0

  return (
    <div>
      <div className="page-title">Estadísticas</div>

      <div className="card" style={{ marginBottom: 14, padding: 16, borderRadius: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4 }}>Periodo</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-strong)', textTransform: 'capitalize', marginTop: 4 }}>{label}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => shiftAnchor(-1)} className="btn-primary btn-outline" style={{ padding: '8px 10px' }}>←</button>
            <input type="month" value={anchorMonth} onChange={e => setAnchorMonth(e.target.value)} className="settings-input" style={{ marginBottom: 0, minWidth: 150 }} />
            <button onClick={() => shiftAnchor(1)} className="btn-primary btn-outline" style={{ padding: '8px 10px' }}>→</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {([['month', 'Mes'], ['3months', '3 meses'], ['year', 'Año']] as [Period, string][]).map(([key, title]) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              style={{
                flex: 1,
                padding: '9px 8px',
                borderRadius: 12,
                border: `1px solid ${period === key ? 'rgba(255,255,255,0.26)' : 'var(--border)'}`,
                background: period === key ? 'rgba(255,255,255,0.10)' : 'var(--bg-soft)',
                color: period === key ? 'var(--text-strong)' : 'var(--text-secondary)',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {title}
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', marginBottom: 14, textTransform: 'capitalize' }}>📅 Custodia · {label}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ flex: 1, height: 16, borderRadius: 8, overflow: 'hidden', display: 'flex' }}>
            {child.parents.map(pid => {
              const pct = stats.totalCustodyDays > 0 ? ((stats.custodyCounts[pid] ?? 0) / stats.totalCustodyDays) * 100 : 50
              return <div key={pid} style={{ width: `${pct}%`, background: child.parentColors?.[pid] ?? '#6b7280', transition: 'width 0.5s' }} />
            })}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginTop: 16 }}>
          {child.parents.map(pid => {
            const days = stats.custodyCounts[pid] ?? 0
            const pct = stats.totalCustodyDays > 0 ? Math.round((days / stats.totalCustodyDays) * 100) : 0
            const weekends = stats.weekendCounts[pid] ?? 0
            const color = child.parentColors?.[pid] ?? '#6b7280'
            const isMe = pid === user?.uid
            return (
              <div key={pid} style={{ background: `${color}15`, border: `1px solid ${color}30`, borderRadius: 14, padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
                  <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>{child.parentNames?.[pid] ?? 'Progenitor'}{isMe ? ' (tú)' : ''}</span>
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{days}</div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{pct}% del periodo · {weekends} fin de semana</div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', marginBottom: 14 }}>🧩 Resumen del periodo</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          <MetricCard label="Días analizados" value={stats.totalCustodyDays} helper={`${stats.weekendDays} de fin de semana`} color="#60a5fa" />
          <MetricCard label="Cambios manuales" value={stats.totals.overrides} helper="sobrescrituras de custodia" color="#f59e0b" />
          <MetricCard label="Eventos" value={stats.totals.events} helper={`${stats.totals.fullDayEvents} todo el día · ${stats.totals.timedEvents} con hora`} color="#10b981" />
          <MetricCard label="Notas" value={stats.totals.notes} helper={`${stats.totals.noteMentions} menciones al otro progenitor`} color="#8b5cf6" />
          <MetricCard label="Bloqueos" value={stats.totals.blocks} helper={`${stats.totals.specialPeriods} periodos especiales`} color="#ef4444" />
          <MetricCard label="Días especiales" value={stats.totals.specialPeriodDays} helper="días cubiertos por periodos especiales" color="#14b8a6" />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', marginBottom: 14 }}>📈 Tendencia últimos 6 meses</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 96 }}>
          {monthlyBreakdown.map(({ month, counts, total, events: monthEvents, requests: monthRequests }) => (
            <div key={month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1, height: 68, justifyContent: 'flex-end' }}>
                {child.parents.map(pid => {
                  const pct = total > 0 ? ((counts[pid] ?? 0) / total) * 100 : 50
                  return <div key={pid} style={{ width: '100%', height: `${pct * 0.68}%`, background: child.parentColors?.[pid] ?? '#6b7280', borderRadius: 3, minHeight: 2 }} />
                })}
              </div>
              <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'capitalize' }}>{month}</div>
              <div style={{ fontSize: 9, color: '#9ca3af', textAlign: 'center' }}>{monthEvents} ev · {monthRequests} camb</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
          {child.parents.map(pid => (
            <div key={pid} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: child.parentColors?.[pid] ?? '#6b7280' }} />
              <span style={{ fontSize: 10, color: '#9ca3af' }}>{child.parentNames?.[pid]?.split(' ')[0]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', marginBottom: 14 }}>🔄 Cambios y apoyos</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 10 }}>
          <MetricCard label="Solicitudes" value={stats.requestBreakdown.total} helper={`${acceptanceRate}% aceptadas · ${stats.requestBreakdown.pending} pendientes`} color="#f59e0b" />
          <MetricCard label="Asignaciones" value={stats.collaboratorBreakdown.total} helper={`${stats.collaboratorBreakdown.accepted} aceptadas · ${stats.collaboratorBreakdown.pending} pendientes`} color="#8b5cf6" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '10px 12px' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#e5e7eb' }}>{stats.requestBreakdown.sentByMe}</div>
            <div style={{ fontSize: 10, color: '#6b7280' }}>solicitudes enviadas por ti</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '10px 12px' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#e5e7eb' }}>{stats.requestBreakdown.receivedByMe}</div>
            <div style={{ fontSize: 10, color: '#6b7280' }}>solicitudes recibidas por ti</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', marginBottom: 14 }}>💊 Medicación</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 10 }}>
          <MetricCard label="Tratamientos activos" value={stats.medicationBreakdown.activePlans} helper={`${stats.medicationBreakdown.totalLogs} tomas registradas`} color="#06b6d4" />
          <MetricCard label="Cumplimiento" value={`${adherence}%`} helper={`${stats.medicationBreakdown.administered} dadas · ${stats.medicationBreakdown.skipped} omitidas`} color="#10b981" />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', marginBottom: 14 }}>🗂️ Totales del perfil</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[
            { label: 'Contactos', value: stats.totals.contacts, color: '#60a5fa' },
            { label: 'Documentos', value: stats.totals.documents, color: '#f59e0b' },
            { label: 'Equipaje', value: stats.totals.packingItems, color: '#8b5cf6' },
          ].map(item => (
            <div key={item.label} style={{ ...metricTone(item.color), borderRadius: 12, padding: '10px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: item.color }}>{item.value}</div>
              <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
