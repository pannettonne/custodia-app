'use client'

import { useMemo, type CSSProperties } from 'react'
import { addDays } from 'date-fns'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { formatDate, getParentForDate, toISODate } from '@/lib/utils'
import styles from './TodayPanel.module.css'

type TodayNavigateTab = 'calendar' | 'requests' | 'notes' | 'events' | 'medications' | 'settings'
type TodayAction = { label: string; tab: TodayNavigateTab; date?: string; openComposer?: 'note' | 'event' }

function toneStyle(tone: string): CSSProperties {
  return { '--today-tone': tone } as CSSProperties
}

function noteMatchesDate(note: any, dateStr: string) {
  if (note.type === 'single') return note.date === dateStr
  if (note.type === 'range') return !!note.startDate && !!note.endDate && dateStr >= note.startDate && dateStr <= note.endDate
  return false
}

function eventMatchesDate(event: any, dateStr: string) {
  if (Array.isArray(event.cancelledDates) && event.cancelledDates.includes(dateStr)) return false

  if (event.recurrence === 'weekly') {
    if (!event.date || !event.recurrenceUntil) return false
    if (dateStr < event.date || dateStr > event.recurrenceUntil) return false
    const jsDay = new Date(dateStr + 'T12:00:00').getDay()
    const weekday = jsDay === 0 ? 7 : jsDay
    const baseDay = new Date(event.date + 'T12:00:00').getDay()
    const fallbackDay = baseDay === 0 ? 7 : baseDay
    const weekdays = Array.isArray(event.recurrenceWeekdays) && event.recurrenceWeekdays.length > 0 ? event.recurrenceWeekdays : [fallbackDay]
    return weekdays.includes(weekday)
  }

  if (event.recurrence === 'monthly') {
    if (!event.date || !event.recurrenceUntil) return false
    if (dateStr < event.date || dateStr > event.recurrenceUntil) return false
    return Number(dateStr.slice(8, 10)) === Number(String(event.date).slice(8, 10))
  }

  if (event.endDate) return dateStr >= event.date && dateStr <= event.endDate
  return event.date === dateStr
}

function requestMatchesDate(request: any, dateStr: string) {
  if (request.type === 'single') return request.date === dateStr
  return !!request.startDate && !!request.endDate && dateStr >= request.startDate && dateStr <= request.endDate
}

function getStatusLabel(status: string) {
  if (status === 'pending') return 'Pendiente'
  if (status === 'accepted') return 'Aceptado'
  if (status === 'rejected') return 'No aceptado'
  if (status === 'cancelled') return 'Cancelado'
  return status
}

function SummaryCard({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return (
    <div className={styles.summaryCard} style={toneStyle(tone)}>
      <div className={styles.summaryLabel}>{label}</div>
      <div className={styles.summaryValue}>{value}</div>
    </div>
  )
}

function TimelineItem({ title, meta, tone, onClick }: { title: string; meta: string; tone: string; onClick?: () => void }) {
  return (
    <button className={styles.timelineItem} onClick={onClick} style={toneStyle(tone)}>
      <div className={styles.timelineContent}>
        <div className={styles.timelineDot} />
        <div className={styles.timelineCopy}>
          <div className={styles.timelineTitle}>{title}</div>
          <div className={styles.timelineMeta}>{meta}</div>
        </div>
      </div>
    </button>
  )
}

export function TodayPanel() {
  const { user } = useAuth()
  const {
    children,
    selectedChildId,
    pattern,
    overrides,
    specialPeriods,
    notes,
    events,
    requests,
    collaboratorAssignments,
    medications,
    medicationLogs,
    setCurrentMonth,
    setSelectedCalendarDate,
  } = useAppStore()

  const today = useMemo(() => new Date(), [])
  const todayStr = toISODate(today)
  const child = useMemo(() => children.find(item => item.id === selectedChildId) ?? null, [children, selectedChildId])
  const isParentForSelectedChild = !!child && !!user?.uid && child.parents.includes(user.uid)
  const isCollaboratorForSelectedChild = !!child && !!user?.uid && !!child.collaborators?.includes(user.uid)

  const custodyInfo = useMemo(() => {
    if (!child) return null
    const parentId = getParentForDate(today, pattern, overrides, child, specialPeriods)
    if (!parentId) return null
    return {
      parentId,
      name: child.parentNames?.[parentId] ?? 'Progenitor',
      color: child.parentColors?.[parentId] ?? '#6B7280',
      isMe: parentId === user?.uid,
    }
  }, [child, today, pattern, overrides, specialPeriods, user?.uid])

  const nextChange = useMemo(() => {
    if (!child || !custodyInfo) return null
    for (let offset = 1; offset <= 45; offset += 1) {
      const date = addDays(today, offset)
      const dateStr = toISODate(date)
      const parentId = getParentForDate(date, pattern, overrides, child, specialPeriods)
      if (parentId && parentId !== custodyInfo.parentId) {
        return {
          date: dateStr,
          name: child.parentNames?.[parentId] ?? 'Progenitor',
          color: child.parentColors?.[parentId] ?? '#6B7280',
        }
      }
    }
    return null
  }, [child, custodyInfo, today, pattern, overrides, specialPeriods])

  const todayEvents = useMemo(() => events.filter(event => eventMatchesDate(event, todayStr)), [events, todayStr])
  const todayNotes = useMemo(() => notes.filter(note => noteMatchesDate(note, todayStr)), [notes, todayStr])
  const todayRequests = useMemo(() => requests.filter(request => requestMatchesDate(request, todayStr)), [requests, todayStr])
  const pendingRequests = useMemo(() => {
    if (!user?.uid) return []
    return requests.filter(request => request.status === 'pending' && (request.toParentId === user.uid || request.fromParentId === user.uid))
  }, [requests, user?.uid])
  const pendingAssignments = useMemo(() => {
    if (!user?.uid) return []
    return collaboratorAssignments.filter(item => item.status === 'pending' && (item.collaboratorId === user.uid || item.createdByParentId === user.uid))
  }, [collaboratorAssignments, user?.uid])
  const activeMedicationsToday = useMemo(() => medications.filter(plan => plan.status === 'active' && todayStr >= plan.startDate && todayStr <= plan.endDate), [medications, todayStr])
  const medicationLogsToday = useMemo(() => medicationLogs.filter(log => log.scheduledDate === todayStr), [medicationLogs, todayStr])

  const goTo = (action: TodayAction) => {
    const targetDate = action.date || todayStr
    setSelectedCalendarDate(targetDate)
    setCurrentMonth(new Date(targetDate + 'T12:00:00'))
    if (typeof window === 'undefined') return
    window.dispatchEvent(new CustomEvent('custodia:navigate', {
      detail: {
        tab: action.tab,
        childId: child?.id,
        date: targetDate,
        openComposer: action.openComposer,
      },
    }))
  }

  if (!child) {
    const onboardingSteps = ['Añade el menor', 'Define el patrón de custodia', 'Invita al otro progenitor']

    return (
      <section className={`card ${styles.onboardingCard}`}>
        <div className={styles.onboardingBadge}>👶</div>
        <div className={styles.eyebrow}>Primeros pasos</div>
        <h2 className={styles.onboardingTitle}>Configura tu calendario familiar</h2>
        <p className={styles.onboardingText}>En unos minutos tendrás la pantalla Hoy preparada con custodia actual, próximos cambios y avisos importantes.</p>

        <div className={styles.onboardingSteps}>
          {onboardingSteps.map((step, index) => (
            <div className={styles.onboardingStep} key={step}>
              <span className={styles.onboardingStepNumber}>{index + 1}</span>
              <span className={styles.onboardingStepText}>{step}</span>
            </div>
          ))}
        </div>

        <button className={styles.onboardingAction} onClick={() => goTo({ label: 'Configurar', tab: 'settings' })}>Empezar configuración</button>
      </section>
    )
  }

  const canCreateFamilyItems = isParentForSelectedChild
  const roleLabel = isParentForSelectedChild ? 'Progenitor' : isCollaboratorForSelectedChild ? 'Colaborador' : 'Vista limitada'

  return (
    <div className={styles.root}>
      <section className={`card ${styles.heroCard}`}>
        <div className={styles.heroHeader}>
          <div className={styles.heroCopy}>
            <div className={styles.eyebrow}>Hoy · {formatDate(todayStr, 'EEEE d MMMM')}</div>
            <div className={styles.heroTitle}>Resumen de {child.name}</div>
            <div className={styles.chips}>
              <span className={styles.chip}>{roleLabel}</span>
              {custodyInfo ? <span className={`${styles.chip} ${styles.custodyChip}`} style={toneStyle(custodyInfo.color)}>Custodia de {custodyInfo.name}{custodyInfo.isMe ? ' · tú' : ''}</span> : null}
            </div>
          </div>
          <button className={styles.ghostButton} onClick={() => goTo({ label: 'Calendario', tab: 'calendar' })}>Abrir calendario</button>
        </div>

        <div className={styles.summaryGrid}>
          <SummaryCard label="Eventos" value={todayEvents.length} tone="#10B981" />
          <SummaryCard label="Cambios" value={pendingRequests.length + pendingAssignments.length} tone="#3B82F6" />
          <SummaryCard label="Notas" value={todayNotes.length} tone="#F59E0B" />
          <SummaryCard label="Medicación" value={activeMedicationsToday.length} tone="#EC4899" />
        </div>
      </section>

      <section className={`card ${styles.cardSection}`}>
        <div className={styles.sectionTitle}>Próximo cambio</div>
        {nextChange ? (
          <button className={styles.changeButton} onClick={() => goTo({ label: 'Próximo cambio', tab: 'calendar', date: nextChange.date })} style={toneStyle(nextChange.color)}>
            <div className={styles.changeDate}>{formatDate(nextChange.date, 'EEEE d MMMM')}</div>
            <div className={styles.changeTitle}>Pasa a <span className={styles.toneText}>{nextChange.name}</span></div>
          </button>
        ) : (
          <div className={styles.mutedText}>No he encontrado un cambio en los próximos 45 días.</div>
        )}
      </section>

      <section className={`card ${styles.cardSection}`}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>Agenda de hoy</div>
          {canCreateFamilyItems ? <button className={styles.linkButton} onClick={() => goTo({ label: 'Nuevo evento', tab: 'events', openComposer: 'event' })} style={toneStyle('#10B981')}>+ evento</button> : null}
        </div>
        <div className={styles.timelineList}>
          {todayEvents.length === 0 && todayNotes.length === 0 && todayRequests.length === 0 ? <div className={styles.mutedText}>No hay eventos, notas ni cambios marcados para hoy.</div> : null}
          {todayEvents.slice(0, 3).map(event => <TimelineItem key={`event-${event.id}`} title={event.title} meta={event.allDay ? 'Todo el día' : event.time || 'Sin hora'} tone="#10B981" onClick={() => goTo({ label: event.title, tab: 'events', date: event.date || todayStr })} />)}
          {todayRequests.slice(0, 2).map(request => <TimelineItem key={`request-${request.id}`} title={request.reason || 'Propuesta de cambio'} meta={getStatusLabel(request.status)} tone="#3B82F6" onClick={() => goTo({ label: 'Cambio', tab: 'requests', date: request.date || request.startDate || todayStr })} />)}
          {todayNotes.slice(0, 2).map(note => <TimelineItem key={`note-${note.id}`} title={note.text} meta={`Nota · ${note.createdByName || 'Progenitor'}`} tone="#F59E0B" onClick={() => goTo({ label: 'Nota', tab: 'notes', date: note.date || note.startDate || todayStr })} />)}
        </div>
      </section>

      <section className={`card ${styles.cardSection}`}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>Salud y avisos</div>
          <button className={styles.linkButton} onClick={() => goTo({ label: 'Medicación', tab: 'medications' })} style={toneStyle('#EC4899')}>Ver medicación</button>
        </div>
        <div className={styles.medicationList}>
          {activeMedicationsToday.length === 0 ? <div className={styles.mutedText}>No hay medicación activa para hoy.</div> : null}
          {activeMedicationsToday.slice(0, 3).map(plan => {
            const logs = medicationLogsToday.filter(log => log.medicationId === plan.id)
            const meta = logs.length > 0 ? `${logs.length} registro(s) hoy` : `Cada ${plan.intervalHours} h desde ${plan.firstDoseTime}`
            return <TimelineItem key={`medication-${plan.id}`} title={plan.name} meta={meta} tone="#EC4899" onClick={() => goTo({ label: 'Medicación', tab: 'medications' })} />
          })}
        </div>
      </section>

      <section className={`card ${styles.cardSection}`}>
        <div className={styles.sectionTitle}>Acciones rápidas</div>
        <div className={styles.quickActions}>
          <button className={`btn-primary ${styles.primaryQuickAction}`} onClick={() => goTo({ label: 'Pedir cambio', tab: 'requests' })}>Pedir cambio</button>
          <button className="btn-primary btn-outline" onClick={() => goTo({ label: 'Calendario', tab: 'calendar' })}>Ver calendario</button>
          {canCreateFamilyItems ? <button className="btn-primary btn-outline" onClick={() => goTo({ label: 'Añadir nota', tab: 'notes', openComposer: 'note' })}>Añadir nota</button> : null}
          {canCreateFamilyItems ? <button className="btn-primary btn-outline" onClick={() => goTo({ label: 'Añadir evento', tab: 'events', openComposer: 'event' })}>Añadir evento</button> : null}
        </div>
      </section>
    </div>
  )
}
