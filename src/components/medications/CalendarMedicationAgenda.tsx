'use client'

import { useEffect, useMemo, useState } from 'react'
import { addDays } from 'date-fns'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { setMedicationLog } from '@/lib/medications-db'
import { getMedicationOccurrencesForDate } from '@/lib/medications'
import { formatDate, toISODate } from '@/lib/utils'
import { blockOverlapsDate, formatAvailabilityBlockLabel } from '@/lib/availability-blocks'
import { MedicationAlertDaemon } from './MedicationAlertDaemon'
import type { AvailabilityBlock, MedicationLogStatus } from '@/types'

export function CalendarMedicationAgenda() {
  const { user } = useAuth()
  const { selectedCalendarDate, medications, medicationLogs, children, selectedChildId, availabilityBlocks } = useAppStore()
  const [loadingKey, setLoadingKey] = useState<string | null>(null)
  const date = selectedCalendarDate || new Date().toISOString().slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)
  const child = useMemo(() => children.find(item => item.id === selectedChildId) ?? null, [children, selectedChildId])
  const canMark = !!user && !!child
  const canQuickActOnDate = date <= today
  const occurrences = useMemo(() => getMedicationOccurrencesForDate(medications, medicationLogs, date), [medications, medicationLogs, date])

  const handleMark = async (occurrence: (typeof occurrences)[number], status: MedicationLogStatus) => {
    if (!user || !child) return
    setLoadingKey(`${occurrence.key}:${status}`)
    try {
      await setMedicationLog({
        childId: child.id,
        medicationId: occurrence.medicationId,
        medicationName: occurrence.medicationName,
        scheduledAt: occurrence.scheduledAt,
        status,
        actedBy: user.uid,
        actedByName: user.displayName || user.email || 'Usuario',
      })
    } finally {
      setLoadingKey(null)
    }
  }

  return (
    <>
      <CalendarTodayEnhancer />
      <MedicationAlertDaemon />
      <CalendarAvailabilitySummary date={date} blocks={availabilityBlocks} />
      {occurrences.length > 0 ? (
        <div className="card" style={{ marginTop: 14, borderColor: 'rgba(239,68,68,0.24)', background:'linear-gradient(180deg, rgba(239,68,68,0.08) 0%, var(--bg-card) 100%)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, marginBottom:10, flexWrap:'wrap' }}>
            <div>
              <div style={{ fontSize:12, color:'#f87171', fontWeight:800, textTransform:'uppercase', letterSpacing:0.4 }}>Medicación</div>
              <div style={{ fontSize:14, color:'var(--text-strong)', fontWeight:800, marginTop:4 }}>{formatDate(date)}</div>
            </div>
            <div style={{ padding:'5px 10px', borderRadius:999, background:'rgba(239,68,68,0.12)', color:'#f87171', fontSize:11, fontWeight:800 }}>{occurrences.length} toma(s)</div>
          </div>
          <div style={{ display:'grid', gap:8 }}>
            {occurrences.map(item => {
              const tone = toneForStatus(item.status)
              const busy = loadingKey === `${item.key}:administered` || loadingKey === `${item.key}:skipped`
              const showActions = canMark && canQuickActOnDate && item.status !== 'administered' && item.status !== 'skipped'

              return (
                <div key={item.key} style={{ padding:'10px 12px', borderRadius:14, background:tone.background, border:`1px solid ${tone.border}` }}>
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8 }}>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:13, color:'var(--text-strong)', fontWeight:800, display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                        <span>💊 {item.medicationName}</span>
                        <span style={{ padding:'3px 7px', borderRadius:999, background:tone.badgeBg, color:tone.badgeText, fontSize:10, fontWeight:800 }}>{labelForStatus(item.status)}</span>
                      </div>
                      <div style={{ fontSize:11, color:'var(--text-secondary)', marginTop:6 }}>{item.dosage} {item.dosageUnit || ''}{item.route ? ` · vía ${item.route.toLowerCase()}` : ''}</div>
                      {item.instructions ? <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>{item.instructions}</div> : null}
                      {item.log?.actedByName ? <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:6 }}>Registrada por {item.log.actedByName}</div> : null}
                    </div>
                    <div style={{ fontSize:11, color:'#f87171', fontWeight:800, flexShrink:0 }}>{item.scheduledTime}</div>
                  </div>

                  {showActions ? (
                    <div style={{ display:'flex', gap:6, marginTop:10, flexWrap:'wrap' }}>
                      <button
                        onClick={() => handleMark(item, 'administered')}
                        disabled={busy}
                        style={{ padding:'6px 10px', borderRadius:999, border:'1px solid rgba(16,185,129,0.24)', background:'rgba(16,185,129,0.12)', color:'#10b981', fontSize:11, fontWeight:800, cursor:busy ? 'not-allowed' : 'pointer', opacity:busy ? 0.7 : 1 }}
                      >
                        OK administrada
                      </button>
                      <button
                        onClick={() => handleMark(item, 'skipped')}
                        disabled={busy}
                        style={{ padding:'6px 10px', borderRadius:999, border:'1px solid rgba(239,68,68,0.24)', background:'rgba(239,68,68,0.10)', color:'#ef4444', fontSize:11, fontWeight:800, cursor:busy ? 'not-allowed' : 'pointer', opacity:busy ? 0.7 : 1 }}
                      >
                        Omitir
                      </button>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
    </>
  )
}

function CalendarAvailabilitySummary({ date, blocks }: { date: string; blocks: AvailabilityBlock[] }) {
  const selectedDayBlocks = useMemo(() => blocks.filter(block => blockOverlapsDate(block, date)), [blocks, date])
  const nextSevenDays = useMemo(() => Array.from({ length: 7 }, (_, index) => toISODate(addDays(new Date(`${date}T12:00:00`), index))), [date])
  const upcomingBlocks = useMemo(() => blocks.filter(block => nextSevenDays.some(day => blockOverlapsDate(block, day))), [blocks, nextSevenDays])

  if (selectedDayBlocks.length === 0 && upcomingBlocks.length === 0) return null

  return (
    <div className="card" style={{ marginTop: 14, borderColor: 'rgba(245,158,11,0.24)', background:'linear-gradient(180deg, rgba(245,158,11,0.08) 0%, var(--bg-card) 100%)' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, marginBottom:10, flexWrap:'wrap' }}>
        <div>
          <div style={{ fontSize:12, color:'#f59e0b', fontWeight:800, textTransform:'uppercase', letterSpacing:0.4 }}>Bloqueos visibles</div>
          <div style={{ fontSize:14, color:'var(--text-strong)', fontWeight:800, marginTop:4 }}>Calendario · {formatDate(date)}</div>
        </div>
        <div style={{ padding:'5px 10px', borderRadius:999, background:'rgba(245,158,11,0.12)', color:'#f59e0b', fontSize:11, fontWeight:800 }}>{selectedDayBlocks.length} hoy / {upcomingBlocks.length} en 7 días</div>
      </div>

      {selectedDayBlocks.length > 0 ? (
        <div style={{ marginBottom: upcomingBlocks.length > 0 ? 10 : 0 }}>
          <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:800, textTransform:'uppercase', letterSpacing:0.4, marginBottom:8 }}>Bloqueos del día seleccionado</div>
          <div style={{ display:'grid', gap:8 }}>
            {selectedDayBlocks.map(block => (
              <AvailabilityBlockCard key={`selected-${block.id}`} block={block} />
            ))}
          </div>
        </div>
      ) : null}

      {upcomingBlocks.length > 0 ? (
        <div>
          <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:800, textTransform:'uppercase', letterSpacing:0.4, marginBottom:8 }}>Próximos 7 días</div>
          <div style={{ display:'grid', gap:8 }}>
            {upcomingBlocks.map(block => (
              <AvailabilityBlockCard key={`upcoming-${block.id}`} block={block} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function AvailabilityBlockCard({ block }: { block: AvailabilityBlock }) {
  return (
    <div style={{ padding:'10px 12px', borderRadius:14, background:'rgba(245,158,11,0.10)', border:'1px solid rgba(245,158,11,0.20)' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, flexWrap:'wrap' }}>
        <div style={{ fontSize:13, color:'var(--text-strong)', fontWeight:800 }}>{block.userName}</div>
        <div style={{ fontSize:10, color:block.ownerRole === 'parent' ? '#60a5fa' : '#8B5CF6', fontWeight:800, textTransform:'uppercase' }}>{block.ownerRole === 'parent' ? 'PROGENITOR' : 'COLABORADOR'}</div>
      </div>
      <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:6 }}>{formatAvailabilityBlockLabel(block)}</div>
      {block.note ? <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:6 }}>{block.note}</div> : null}
    </div>
  )
}

function CalendarTodayEnhancer() {
  const { setSelectedCalendarDate, setCurrentMonth } = useAppStore()

  useEffect(() => {
    const goToToday = () => {
      const today = new Date()
      const todayStr = today.toISOString().slice(0, 10)
      setSelectedCalendarDate(todayStr)
      setCurrentMonth(new Date(`${todayStr}T12:00:00`))
    }

    const bindTodayButton = () => {
      const buttons = Array.from(document.querySelectorAll('button')) as HTMLButtonElement[]
      const dayButton = buttons.find((button) => {
        const label = (button.textContent || '').trim()
        if (label !== 'Día' && label !== 'Hoy') return false
        const siblings = button.parentElement
          ? Array.from(button.parentElement.children).filter((item): item is HTMLButtonElement => item instanceof HTMLButtonElement)
          : []
        const labels = siblings.map((item) => (item.textContent || '').trim())
        return labels.includes('Semana') && labels.includes('Mes')
      })

      if (!dayButton) return
      if ((dayButton.textContent || '').trim() !== 'Hoy') dayButton.textContent = 'Hoy'
      if (dayButton.dataset.custodiaTodayBound === 'true') return

      dayButton.dataset.custodiaTodayBound = 'true'
      dayButton.addEventListener('click', goToToday)
    }

    bindTodayButton()
    const observer = new MutationObserver(() => bindTodayButton())
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })

    return () => observer.disconnect()
  }, [setCurrentMonth, setSelectedCalendarDate])

  return null
}

function labelForStatus(status: string) {
  if (status === 'administered') return 'Hecha'
  if (status === 'skipped') return 'Omitida'
  if (status === 'overdue') return 'Atrasada'
  if (status === 'due_soon') return 'Proxima'
  return 'Pendiente'
}

function toneForStatus(status: string) {
  if (status === 'administered') {
    return { background: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.20)', badgeBg: 'rgba(16,185,129,0.12)', badgeText: '#10b981' }
  }
  if (status === 'skipped') {
    return { background: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.18)', badgeBg: 'rgba(239,68,68,0.12)', badgeText: '#ef4444' }
  }
  if (status === 'overdue') {
    return { background: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.18)', badgeBg: 'rgba(245,158,11,0.12)', badgeText: '#f59e0b' }
  }
  if (status === 'due_soon') {
    return { background: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.18)', badgeBg: 'rgba(59,130,246,0.12)', badgeText: '#60a5fa' }
  }
  return { background: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.18)', badgeBg: 'rgba(148,163,184,0.12)', badgeText: '#64748b' }
}
