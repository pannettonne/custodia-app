'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { setMedicationLog } from '@/lib/medications-db'
import { getMedicationOccurrencesForDate } from '@/lib/medications'
import { formatDate } from '@/lib/utils'
import { MedicationAlertDaemon } from './MedicationAlertDaemon'
import type { MedicationLogStatus } from '@/types'

export function CalendarMedicationAgenda() {
  const { user } = useAuth()
  const { selectedCalendarDate, medications, medicationLogs, children, selectedChildId } = useAppStore()
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
      <CalendarViewEnhancer />
      <MedicationAlertDaemon />
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

function CalendarViewEnhancer() {
  useEffect(() => {
    const styleId = 'custodia-calendar-view-enhancer-style'
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style')
      style.id = styleId
      style.textContent = `
        .cal-cell.today {
          border-color: #3B82F6 !important;
          border-width: 2px !important;
          box-shadow: 0 10px 22px rgba(59,130,246,0.14) !important;
        }
        .cal-cell.today .cal-day-num {
          color: #2563EB !important;
        }
        .custodia-today-badge,
        .custodia-week-today-badge {
          position: absolute;
          top: 6px;
          right: 6px;
          padding: 2px 6px;
          border-radius: 999px;
          background: rgba(59,130,246,0.14);
          color: #2563EB;
          font-size: 8px;
          font-weight: 900;
          line-height: 1;
          pointer-events: none;
        }
        .custodia-week-today {
          border-color: #3B82F6 !important;
          box-shadow: 0 8px 18px rgba(59,130,246,0.12) !important;
        }
      `
      document.head.appendChild(style)
    }

    const normalizeMonth = (value: string) => value.toLowerCase().replace(/\./g, '').trim()

    const applyEnhancements = () => {
      const allButtons = Array.from(document.querySelectorAll('button'))

      const modeButtons = allButtons.filter((button) => {
        const parent = button.parentElement
        if (!parent) return false
        const directButtons = Array.from(parent.children).filter((child): child is HTMLButtonElement => child instanceof HTMLButtonElement)
        if (directButtons.length !== 4) return false
        const labels = directButtons.map((item) => (item.textContent || '').trim())
        return labels.includes('Semana') && labels.includes('Mes') && labels.includes('Próximos')
      })

      const dayToggle = modeButtons[0] || null
      if (dayToggle) {
        if ((dayToggle.textContent || '').trim() !== 'Hoy') {
          dayToggle.textContent = 'Hoy'
        }
        if (dayToggle.dataset.custodiaHoyHooked !== 'true') {
          dayToggle.dataset.custodiaHoyHooked = 'true'
          dayToggle.addEventListener('click', () => {
            window.setTimeout(() => {
              const todayButtons = Array.from(document.querySelectorAll('button')).filter((button) => (button.textContent || '').trim() === 'Hoy')
              const headerTodayButton = todayButtons.find((button) => button !== dayToggle)
              headerTodayButton?.click()
            }, 0)
          })
        }
      }

      document.querySelectorAll('.cal-cell.today').forEach((cell) => {
        if (!cell.querySelector('.custodia-today-badge')) {
          const badge = document.createElement('div')
          badge.className = 'custodia-today-badge'
          badge.textContent = 'HOY'
          cell.appendChild(badge)
        }
      })

      const todayDate = new Date()
      const todayDay = String(todayDate.getDate())
      const todayMonth = normalizeMonth(todayDate.toLocaleDateString('es-ES', { month: 'short' }))

      const weekRows = Array.from(document.querySelectorAll('div')).filter((node) => {
        const directButtons = Array.from(node.children).filter((child): child is HTMLButtonElement => child instanceof HTMLButtonElement)
        return directButtons.length === 7
      })

      weekRows.forEach((row) => {
        const directButtons = Array.from(row.children).filter((child): child is HTMLButtonElement => child instanceof HTMLButtonElement)
        directButtons.forEach((button) => {
          button.classList.remove('custodia-week-today')
          button.querySelector('.custodia-week-today-badge')?.remove()

          const divs = Array.from(button.querySelectorAll(':scope > div'))
          if (divs.length < 3) return

          const dayNumber = (divs[1]?.textContent || '').trim()
          const monthLabel = normalizeMonth((divs[2]?.textContent || '').trim())
          if (dayNumber !== todayDay || monthLabel !== todayMonth) return

          button.classList.add('custodia-week-today')
          button.style.position = 'relative'
          const badge = document.createElement('div')
          badge.className = 'custodia-week-today-badge'
          badge.textContent = 'HOY'
          button.appendChild(badge)
        })
      })
    }

    applyEnhancements()
    const observer = new MutationObserver(() => applyEnhancements())
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })

    return () => observer.disconnect()
  }, [])

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
