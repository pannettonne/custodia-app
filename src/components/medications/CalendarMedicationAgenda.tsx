'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { setMedicationLog } from '@/lib/medications-db'
import { getMedicationOccurrencesForDate } from '@/lib/medications'
import { formatDate } from '@/lib/utils'
import { blockOverlapsDate, formatAvailabilityBlockLabel } from '@/lib/availability-blocks'
import { MedicationAlertDaemon } from './MedicationAlertDaemon'
import type { AvailabilityBlock, MedicationLogStatus } from '@/types'

export function CalendarMedicationAgenda() {
  const { user } = useAuth()
  const {
    selectedCalendarDate,
    medications,
    medicationLogs,
    children,
    selectedChildId,
    availabilityBlocks,
    notes,
    events,
    requests,
    collaboratorAssignments,
  } = useAppStore()
  const [loadingKey, setLoadingKey] = useState<string | null>(null)
  const date = selectedCalendarDate || new Date().toISOString().slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)
  const child = useMemo(() => children.find(item => item.id === selectedChildId) ?? null, [children, selectedChildId])
  const canMark = !!user && !!child
  const canQuickActOnDate = date <= today
  const occurrences = useMemo(() => getMedicationOccurrencesForDate(medications, medicationLogs, date), [medications, medicationLogs, date])
  const selectedDayBlocks = useMemo(() => availabilityBlocks.filter(block => blockOverlapsDate(block, date)), [availabilityBlocks, date])

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
      <CalendarDayDetailSimplifier
        selectedDate={date}
        hasBlocks={selectedDayBlocks.length > 0}
        rerenderKey={`${events.length}-${requests.length}-${collaboratorAssignments.length}-${notes.length}-${selectedDayBlocks.length}`}
      />
      <CalendarAvailabilityInline blocks={selectedDayBlocks} />
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

function CalendarAvailabilityInline({ blocks }: { blocks: AvailabilityBlock[] }) {
  useEffect(() => {
    const injectedAttr = 'data-custodia-inline-blocks'
    let retries = 0
    let timeoutId: number | null = null
    let cancelled = false

    const removeExisting = () => {
      document.querySelectorAll(`[${injectedAttr}]`).forEach(node => node.remove())
    }

    const buildWrapper = () => {
      const wrapper = document.createElement('div')
      wrapper.setAttribute(injectedAttr, 'true')
      wrapper.style.marginBottom = '10px'
      wrapper.style.padding = '10px 12px'
      wrapper.style.borderRadius = '14px'
      wrapper.style.border = '1px solid rgba(245,158,11,0.20)'
      wrapper.style.background = 'rgba(245,158,11,0.10)'

      const title = document.createElement('div')
      title.textContent = 'Bloqueos del día'
      title.style.fontSize = '11px'
      title.style.fontWeight = '800'
      title.style.letterSpacing = '0.4px'
      title.style.textTransform = 'uppercase'
      title.style.color = '#f59e0b'
      title.style.marginBottom = '8px'
      wrapper.appendChild(title)

      blocks.forEach((block, index) => {
        const row = document.createElement('div')
        row.style.display = 'flex'
        row.style.alignItems = 'center'
        row.style.justifyContent = 'space-between'
        row.style.gap = '8px'
        row.style.flexWrap = 'wrap'
        if (index > 0) row.style.marginTop = '8px'

        const left = document.createElement('div')
        left.style.minWidth = '0'

        const name = document.createElement('div')
        name.textContent = block.userName
        name.style.fontSize = '12px'
        name.style.fontWeight = '800'
        name.style.color = 'var(--text-strong)'
        left.appendChild(name)

        const period = document.createElement('div')
        period.textContent = formatAvailabilityBlockLabel(block)
        period.style.fontSize = '11px'
        period.style.color = 'var(--text-secondary)'
        period.style.marginTop = '4px'
        left.appendChild(period)

        if (block.note) {
          const note = document.createElement('div')
          note.textContent = block.note
          note.style.fontSize = '10px'
          note.style.color = 'var(--text-muted)'
          note.style.marginTop = '4px'
          left.appendChild(note)
        }

        const badge = document.createElement('div')
        badge.textContent = block.ownerRole === 'parent' ? 'PROGENITOR' : 'COLABORADOR'
        badge.style.fontSize = '10px'
        badge.style.fontWeight = '800'
        badge.style.color = block.ownerRole === 'parent' ? '#60a5fa' : '#8B5CF6'

        row.appendChild(left)
        row.appendChild(badge)
        wrapper.appendChild(row)
      })

      return wrapper
    }

    const tryInject = () => {
      if (cancelled) return
      removeExisting()

      if (blocks.length === 0) return

      const titleNode = Array.from(document.querySelectorAll('div')).find(node => (node.textContent || '').trim() === 'Solicitudes de cambio') as HTMLDivElement | undefined
      const sectionNode = titleNode?.parentElement?.parentElement
      const headerNode = sectionNode?.firstElementChild

      if (sectionNode && headerNode) {
        const wrapper = buildWrapper()
        if (headerNode.nextSibling) sectionNode.insertBefore(wrapper, headerNode.nextSibling)
        else sectionNode.appendChild(wrapper)
        return
      }

      if (retries < 20) {
        retries += 1
        timeoutId = window.setTimeout(tryInject, 120)
      }
    }

    timeoutId = window.setTimeout(tryInject, 0)

    return () => {
      cancelled = true
      if (timeoutId) window.clearTimeout(timeoutId)
      removeExisting()
    }
  }, [blocks])

  return null
}

function CalendarDayDetailSimplifier({ selectedDate, hasBlocks, rerenderKey }: { selectedDate: string; hasBlocks: boolean; rerenderKey: string }) {
  useEffect(() => {
    const actionAttr = 'data-custodia-day-plus'
    let retries = 0
    let timeoutId: number | null = null
    let cancelled = false
    let cleanupOutsideClick: (() => void) | null = null

    const findSectionCard = (title: string) => {
      const titleNode = Array.from(document.querySelectorAll('div')).find(node => (node.textContent || '').trim() === title) as HTMLDivElement | undefined
      return titleNode?.parentElement?.parentElement as HTMLDivElement | undefined
    }

    const removeInjected = () => {
      document.querySelectorAll(`[${actionAttr}]`).forEach(node => node.remove())
      cleanupOutsideClick?.()
      cleanupOutsideClick = null
    }

    const triggerQuickAction = (label: string) => {
      const button = Array.from(document.querySelectorAll('button')).find(node => (node.textContent || '').trim() === label) as HTMLButtonElement | undefined
      button?.click()
    }

    const setVisibility = (title: string, visible: boolean) => {
      const sectionCard = findSectionCard(title)
      if (!sectionCard) return false
      sectionCard.style.display = visible ? '' : 'none'
      return true
    }

    const buildQuickActions = () => {
      const wrapper = document.createElement('div')
      wrapper.setAttribute(actionAttr, 'true')
      wrapper.style.position = 'relative'
      wrapper.style.display = 'flex'
      wrapper.style.alignItems = 'center'
      wrapper.style.justifyContent = 'center'
      wrapper.style.flexShrink = '0'

      const trigger = document.createElement('button')
      trigger.type = 'button'
      trigger.setAttribute('aria-label', 'Abrir acciones rápidas del día')
      trigger.title = 'Añadir'
      trigger.textContent = '+'
      trigger.style.width = '48px'
      trigger.style.height = '48px'
      trigger.style.borderRadius = '999px'
      trigger.style.border = '1px solid rgba(59,130,246,0.22)'
      trigger.style.background = 'linear-gradient(180deg, rgba(59,130,246,0.14) 0%, rgba(37,99,235,0.22) 100%)'
      trigger.style.color = '#3B82F6'
      trigger.style.fontSize = '28px'
      trigger.style.fontWeight = '700'
      trigger.style.lineHeight = '1'
      trigger.style.cursor = 'pointer'
      trigger.style.display = 'flex'
      trigger.style.alignItems = 'center'
      trigger.style.justifyContent = 'center'
      trigger.style.boxShadow = '0 10px 24px rgba(59,130,246,0.14)'

      const menu = document.createElement('div')
      menu.style.position = 'absolute'
      menu.style.top = 'calc(100% + 8px)'
      menu.style.right = '0'
      menu.style.minWidth = '170px'
      menu.style.padding = '8px'
      menu.style.borderRadius = '16px'
      menu.style.border = '1px solid var(--border)'
      menu.style.background = 'var(--bg-card)'
      menu.style.boxShadow = '0 18px 36px rgba(15,23,42,0.16)'
      menu.style.display = 'none'
      menu.style.zIndex = '80'

      const actions = [
        { label: '+ evento', text: 'Nuevo evento', color: '#10b981' },
        { label: '+ cambio', text: 'Nuevo cambio', color: '#60a5fa' },
        { label: '+ asignación', text: 'Nueva asignación', color: '#8B5CF6' },
        { label: '+ nota', text: 'Nueva nota', color: '#f59e0b' },
      ].filter(action => Array.from(document.querySelectorAll('button')).some(node => (node.textContent || '').trim() === action.label))

      actions.forEach(action => {
        const item = document.createElement('button')
        item.type = 'button'
        item.textContent = action.text
        item.style.width = '100%'
        item.style.textAlign = 'left'
        item.style.padding = '10px 12px'
        item.style.borderRadius = '12px'
        item.style.border = 'none'
        item.style.background = 'transparent'
        item.style.color = action.color
        item.style.fontSize = '12px'
        item.style.fontWeight = '800'
        item.style.cursor = 'pointer'
        item.addEventListener('click', event => {
          event.preventDefault()
          event.stopPropagation()
          menu.style.display = 'none'
          triggerQuickAction(action.label)
        })
        item.addEventListener('mouseenter', () => {
          item.style.background = 'var(--bg-soft)'
        })
        item.addEventListener('mouseleave', () => {
          item.style.background = 'transparent'
        })
        menu.appendChild(item)
      })

      trigger.addEventListener('click', event => {
        event.preventDefault()
        event.stopPropagation()
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none'
      })

      const handleOutsideClick = (event: MouseEvent) => {
        if (!wrapper.contains(event.target as Node)) menu.style.display = 'none'
      }
      document.addEventListener('click', handleOutsideClick)
      cleanupOutsideClick = () => document.removeEventListener('click', handleOutsideClick)

      wrapper.appendChild(trigger)
      if (actions.length > 0) wrapper.appendChild(menu)
      return wrapper
    }

    const tryApply = () => {
      if (cancelled) return
      removeInjected()

      const closeButton = document.querySelector('button[aria-label="Cerrar detalle del día"]') as HTMLButtonElement | null
      if (!closeButton) {
        if (retries < 20) {
          retries += 1
          timeoutId = window.setTimeout(tryApply, 120)
        }
        return
      }

      closeButton.style.display = 'none'
      const actionContainer = closeButton.parentElement
      if (actionContainer) {
        actionContainer.style.gap = '0'
        actionContainer.appendChild(buildQuickActions())
      }

      const eventsCard = findSectionCard('Eventos')
      const requestsCard = findSectionCard('Solicitudes de cambio')
      const collaboratorsCard = findSectionCard('Colaboradores')
      const notesCard = findSectionCard('Notas')

      const foundAnySection = !!(eventsCard || requestsCard || collaboratorsCard || notesCard)
      if (!foundAnySection) {
        if (retries < 20) {
          retries += 1
          timeoutId = window.setTimeout(tryApply, 120)
        }
        return
      }

      setVisibility('Eventos', !(eventsCard?.textContent || '').includes('No hay eventos para este día.'))
      setVisibility('Solicitudes de cambio', hasBlocks || !(requestsCard?.textContent || '').includes('No hay solicitudes para este día.'))
      setVisibility('Colaboradores', !(collaboratorsCard?.textContent || '').includes('No hay asignaciones de colaboradores para este día.'))
      setVisibility('Notas', !(notesCard?.textContent || '').includes('No hay notas para este día.'))
    }

    timeoutId = window.setTimeout(tryApply, 0)

    return () => {
      cancelled = true
      if (timeoutId) window.clearTimeout(timeoutId)
      removeInjected()
      const closeButton = document.querySelector('button[aria-label="Cerrar detalle del día"]') as HTMLButtonElement | null
      if (closeButton) closeButton.style.display = ''
      ;['Eventos', 'Solicitudes de cambio', 'Colaboradores', 'Notas'].forEach(title => {
        const card = findSectionCard(title)
        if (card) card.style.display = ''
      })
    }
  }, [selectedDate, hasBlocks, rerenderKey])

  return null
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
