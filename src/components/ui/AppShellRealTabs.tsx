'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { useDataSubscriptions } from '@/hooks/useDataSubscriptions'
import { TodayPanel } from '@/components/today/TodayPanel'
import { CustodyCalendar } from '@/components/calendar/CustodyCalendar'
import { CalendarMedicationAgenda } from '@/components/medications/CalendarMedicationAgenda'
import { RequestsList } from '@/components/requests/RequestsList'
import { RejectedItemsCleanupPanel } from '@/components/requests/RejectedItemsCleanupPanel'
import { CollaboratorAssignmentCalendarPanel } from '@/components/collaborators/CollaboratorAssignmentCalendarPanel'
import { NotesPanel } from '@/components/notes/NotesPanel'
import { EventsPanel } from '@/components/events/EventsPanel'
import { DocumentsPanel } from '@/components/documents/DocumentsPanel'
import { PackingPanel } from '@/components/packing/PackingPanel'
import { ContactsPanel } from '@/components/contacts/ContactsPanel'
import { MedicationsPanel } from '@/components/medications/MedicationsPanel'
import { StatsPanel } from '@/components/stats/StatsPanel'
import { SettingsPanel } from '@/components/settings/SettingsPanel'
import { QuickDateQuery } from '@/components/calendar/QuickDateQuery'
import { GlobalToasts } from '@/components/ui/GlobalToasts'
import { markNotificationRead } from '@/lib/db'
import { attachForegroundPushLogger } from '@/lib/push'
import { showToast } from '@/lib/toast'
import type { AppNotification } from '@/types'

type Tab = 'today' | 'calendar' | 'requests' | 'events' | 'more' | 'notes' | 'documents' | 'packing' | 'contacts' | 'medications' | 'stats' | 'settings' | 'blocks'
type FocusTarget = { id: string; seq: number } | null
type DraftTarget = { date: string; seq: number } | null

type NavigateDetail = {
  tab: Tab
  childId?: string
  date?: string
  focusTargetId?: string
  openComposer?: 'note' | 'event'
}

type MoreCard = {
  id: Tab
  title: string
  subtitle: string
  icon?: string
  emoji?: string
  tone: string
}

const HEADER_SEARCH_ICON = '/shell-icons/search.svg'
const HEADER_BELL_ICON = '/shell-icons/bell.svg'

function buildForegroundPushMessage(payload: any) {
  const title = payload?.notification?.title || 'Nuevo aviso'
  const body = payload?.notification?.body || ''
  return body ? `${title}: ${body}` : title
}

function inferTargetTab(item: AppNotification): Tab {
  if (item.targetTab) return item.targetTab as Tab
  if (item.type === 'pending_request' || item.type === 'event_assignment_pending' || item.type === 'event_assignment_response') return 'requests'
  if (item.type === 'event_reminder') return 'events'
  if (item.type === 'medication_reminder') return 'medications'
  return 'today'
}

function isMoreArea(tab: Tab) {
  return ['more', 'notes', 'documents', 'packing', 'contacts', 'medications', 'stats', 'settings', 'blocks'].includes(tab)
}

function topOfMain() {
  if (typeof document === 'undefined') return
  const main = document.querySelector<HTMLElement>('.app-main')
  if (!main) return
  main.scrollTop = 0
  requestAnimationFrame(() => { main.scrollTop = 0 })
}

export function AppShellRealTabs() {
  const { user, signOut } = useAuth()
  const {
    children,
    selectedChildId,
    setSelectedChildId,
    requests,
    collaboratorAssignments,
    invitations,
    notes,
    notifications,
    selectedCalendarDate,
    setSelectedCalendarDate,
    setCurrentMonth,
  } = useAppStore()

  const [tab, setTab] = useState<Tab>('today')
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [queryOpen, setQueryOpen] = useState(false)
  const [focusTarget, setFocusTarget] = useState<FocusTarget>(null)
  const [noteDraftTarget, setNoteDraftTarget] = useState<DraftTarget>(null)
  const [eventDraftTarget, setEventDraftTarget] = useState<DraftTarget>(null)
  const previousSelectedDateRef = useRef<string | null>(selectedCalendarDate)

  useDataSubscriptions()

  useEffect(() => {
    if (typeof window === 'undefined') return
    let unsubscribe = () => {}
    let disposed = false
    void (async () => {
      unsubscribe = await attachForegroundPushLogger(payload => {
        showToast({ message: buildForegroundPushMessage(payload), tone: 'info' })
      })
      if (disposed) unsubscribe()
    })()
    return () => {
      disposed = true
      unsubscribe()
    }
  }, [])

  const child = useMemo(() => children.find(c => c.id === selectedChildId) ?? null, [children, selectedChildId])
  const isParentForSelectedChild = !!child && !!user?.uid && child.parents.includes(user.uid)
  const isCollaboratorForSelectedChild = !!child && !!user?.uid && !!child.collaborators?.includes(user.uid)

  const allowedTabs: Tab[] = isParentForSelectedChild
    ? ['today', 'calendar', 'requests', 'events', 'more', 'notes', 'documents', 'packing', 'contacts', 'medications', 'stats', 'settings', 'blocks']
    : isCollaboratorForSelectedChild
      ? ['today', 'calendar', 'requests', 'more', 'contacts', 'medications', 'settings']
      : ['today', 'calendar', 'more', 'settings']

  const pendingReqs = useMemo(() => {
    if (!user?.uid) return 0
    const incomingChanges = isParentForSelectedChild ? requests.filter(r => r.status === 'pending' && r.toParentId === user.uid).length : 0
    const incomingCollaboratorAssignments = collaboratorAssignments.filter(a => a.status === 'pending' && ((isParentForSelectedChild && a.createdByParentId === user.uid) || (isCollaboratorForSelectedChild && a.collaboratorId === user.uid))).length
    return incomingChanges + incomingCollaboratorAssignments
  }, [requests, collaboratorAssignments, user?.uid, isParentForSelectedChild, isCollaboratorForSelectedChild])

  const unreadNotes = useMemo(() => isParentForSelectedChild ? notes.filter(n => !n.read && n.createdBy !== user?.uid && n.mentionOther).length : 0, [notes, user?.uid, isParentForSelectedChild])
  const pendingInvitations = useMemo(() => {
    const myEmail = (user?.email ?? '').trim().toLowerCase()
    return invitations.filter(i => i.status === 'pending' && i.toEmail === myEmail).length
  }, [invitations, user?.email])
  const unreadNotifications = useMemo(() => notifications.filter(n => !n.read).length, [notifications])
  const totalBadge = pendingReqs + pendingInvitations + unreadNotes + unreadNotifications

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const targetTab = params.get('tab') as Tab | null
    const childId = params.get('childId')
    const date = params.get('date')
    if (childId) setSelectedChildId(childId)
    if (date) {
      setSelectedCalendarDate(date)
      setCurrentMonth(new Date(date + 'T12:00:00'))
    }
    if (targetTab && allowedTabs.includes(targetTab)) setTab(targetTab)
  }, [allowedTabs.join('|'), setCurrentMonth, setSelectedCalendarDate, setSelectedChildId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<NavigateDetail>).detail
      if (!detail) return
      if (detail.childId) setSelectedChildId(detail.childId)
      if (detail.date) {
        setSelectedCalendarDate(detail.date)
        setCurrentMonth(new Date(detail.date + 'T12:00:00'))
      }
      const nextTab = allowedTabs.includes(detail.tab) ? detail.tab : 'calendar'
      setTab(nextTab)
      setUserMenuOpen(false)
      setNotifOpen(false)
      setQueryOpen(false)
      if (detail.focusTargetId) setFocusTarget({ id: detail.focusTargetId, seq: Date.now() })
      if (detail.openComposer === 'note' && detail.date) setNoteDraftTarget({ date: detail.date, seq: Date.now() })
      if (detail.openComposer === 'event' && detail.date) setEventDraftTarget({ date: detail.date, seq: Date.now() })
      topOfMain()
    }
    window.addEventListener('custodia:navigate', handler as EventListener)
    return () => window.removeEventListener('custodia:navigate', handler as EventListener)
  }, [allowedTabs.join('|'), setCurrentMonth, setSelectedCalendarDate, setSelectedChildId])

  useEffect(() => {
    if (!allowedTabs.includes(tab)) setTab('today')
  }, [allowedTabs.join('|'), tab])

  useEffect(() => {
    if (tab === 'today' && selectedCalendarDate && selectedCalendarDate !== previousSelectedDateRef.current) {
      setTab('calendar')
    }
    previousSelectedDateRef.current = selectedCalendarDate
  }, [selectedCalendarDate, tab])

  const navigate = (nextTab: Tab) => {
    if (!allowedTabs.includes(nextTab)) return
    setTab(nextTab)
    setUserMenuOpen(false)
    setNotifOpen(false)
    setQueryOpen(false)
    topOfMain()
  }

  const openNotification = async (item: AppNotification) => {
    await markNotificationRead(item.id)
    if (item.childId) setSelectedChildId(item.childId)
    if (item.targetDate) {
      setSelectedCalendarDate(item.targetDate)
      setCurrentMonth(new Date(item.targetDate + 'T12:00:00'))
    }
    navigate(inferTargetTab(item))
  }

  const bottomTabs = isParentForSelectedChild ? [
    { id: 'today' as Tab, label: 'Hoy', icon: '/nav-icons/calendar.svg', badge: totalBadge },
    { id: 'calendar' as Tab, label: 'Calendario', icon: '/nav-icons/calendar.svg' },
    { id: 'requests' as Tab, label: 'Cambios', icon: '/nav-icons/changes.svg', badge: pendingReqs },
    { id: 'events' as Tab, label: 'Eventos', icon: '/nav-icons/events.svg' },
    { id: 'more' as Tab, label: 'Más', icon: '/nav-icons/more.svg', badge: pendingInvitations },
  ] : [
    { id: 'today' as Tab, label: 'Hoy', icon: '/nav-icons/calendar.svg', badge: totalBadge },
    { id: 'calendar' as Tab, label: 'Calendario', icon: '/nav-icons/calendar.svg' },
    { id: 'requests' as Tab, label: 'Cambios', icon: '/nav-icons/changes.svg', badge: pendingReqs },
    { id: 'more' as Tab, label: 'Más', icon: '/nav-icons/more.svg', badge: pendingInvitations },
  ]

  return (
    <div className="app-shell" onClick={() => { setUserMenuOpen(false); setNotifOpen(false); setQueryOpen(false) }}>
      <GlobalToasts />
      <header className="app-header" onClick={e => e.stopPropagation()} style={{ paddingBottom: 8, marginBottom: 4 }}>
        <div style={{ width: '100%', padding: '10px 12px', borderRadius: 20, background: 'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-soft) 100%)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'nowrap' }}>
            <div className="app-header-left" style={{ gap: 10, flex: 1, minWidth: 0 }}>
              <img src="/apple-touch-icon.png?v=4" alt="Custodia" className="app-logo" style={{ width: 36, height: 36, borderRadius: 12, boxShadow: 'var(--card-shadow)', objectFit: 'cover' }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.45, marginBottom: 1 }}>Familia organizada</div>
                <div className="app-title" style={{ fontSize: 19, lineHeight: 1.1 }}>CustodiaApp</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative', marginTop: 2, minWidth: 0 }}>
                  {child && <div className="app-subtitle" style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{child.name}{isCollaboratorForSelectedChild && !isParentForSelectedChild ? ' · colaborador' : ''}</div>}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <button onClick={() => { setUserMenuOpen(false); setNotifOpen(false); setQueryOpen(v => !v) }} title="Consulta rápida" style={{ width: 20, height: 20, borderRadius: '50%', border: '1px solid var(--border-hover)', background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>?</button>
                    {queryOpen && <div className="header-popup-menu" style={{ position: 'fixed', top: 74, left: 16, right: 16, width: 'auto', maxWidth: 320, margin: '0 auto', padding: 0, overflow: 'hidden' }}><QuickDateQuery /></div>}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, position: 'relative', flexWrap: 'nowrap', justifyContent: 'flex-end', marginLeft: 8, flexShrink: 0 }}>
              <button title="Buscar" style={{ height: 34, width: 34, borderRadius: 12, border: '1px solid var(--border-hover)', background: 'var(--bg-card)', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--card-shadow)', flexShrink: 0 }}><img src={HEADER_SEARCH_ICON} alt="" aria-hidden="true" style={{ width: 18, height: 18, objectFit: 'contain' }} /></button>
              {children.length > 1 && <select value={selectedChildId ?? ''} onChange={e => setSelectedChildId(e.target.value)} style={{ maxWidth: 120, background: 'var(--bg-card)', border: '1px solid var(--border-hover)', borderRadius: 12, padding: '7px 10px', color: 'var(--text-strong)', fontSize: 11, outline: 'none', boxShadow: 'var(--card-shadow)', flexShrink: 1 }}>{children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <button className="notif-btn" onClick={() => { setUserMenuOpen(false); setQueryOpen(false); setNotifOpen(v => !v) }} style={{ width: 34, height: 34, borderRadius: 12, background: 'var(--bg-card)', border: '1px solid var(--border-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><img src={HEADER_BELL_ICON} alt="" aria-hidden="true" style={{ width: 18, height: 18, objectFit: 'contain' }} />{totalBadge > 0 ? <span className="notif-count">{totalBadge}</span> : null}</button>
                {notifOpen && <div className="header-popup-menu notifications-popup-menu" style={{ right: 0, left: 'auto', width: 'min(300px, calc(100vw - 28px))', maxHeight: '70vh', overflow: 'auto' }}>{notifications.length === 0 ? <div className="popup-empty">No hay avisos.</div> : notifications.slice(0, 30).map(item => <button key={item.id} className="notification-item" onClick={() => openNotification(item)}><div className="notification-item-title">{item.title}</div><div className="notification-item-body">{item.body}</div>{!item.read && <div className="notification-item-dot" />}</button>)}</div>}
              </div>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <button className="user-avatar" onClick={() => { setNotifOpen(false); setQueryOpen(false); setUserMenuOpen(v => !v) }} title="Usuario" style={{ width: 34, height: 34, borderRadius: 12 }}>{user?.photoURL ? <img src={user.photoURL} alt="" /> : (user?.displayName ?? user?.email ?? 'U')[0].toUpperCase()}</button>
                {userMenuOpen && <div className="header-popup-menu user-popup-menu" style={{ right: 0, left: 'auto', width: 'min(220px, calc(100vw - 28px))' }}><div className="popup-menu-label">{user?.displayName ?? user?.email}</div><button className="popup-menu-item danger" onClick={signOut}>Cerrar sesión</button></div>}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="app-main" onClick={e => e.stopPropagation()}>
        {tab === 'today' && <TodayPanel />}
        {tab === 'calendar' && <><CustodyCalendar /><CalendarMedicationAgenda /></>}
        {tab === 'requests' && (isParentForSelectedChild || isCollaboratorForSelectedChild) && <><RequestsList focusTargetId={focusTarget?.id} focusSeq={focusTarget?.seq} />{isCollaboratorForSelectedChild && !isParentForSelectedChild && <CollaboratorAssignmentCalendarPanel />}</>}
        {tab === 'events' && isParentForSelectedChild && <EventsPanel focusTargetId={focusTarget?.id} focusSeq={focusTarget?.seq} initialCreateDate={eventDraftTarget?.date} createSeq={eventDraftTarget?.seq} />}
        {tab === 'more' && <MorePanel isParent={isParentForSelectedChild} isCollaborator={isCollaboratorForSelectedChild} navigate={navigate} />}
        {tab === 'notes' && isParentForSelectedChild && <NotesPanel focusTargetId={focusTarget?.id} focusSeq={focusTarget?.seq} initialCreateDate={noteDraftTarget?.date} createSeq={noteDraftTarget?.seq} />}
        {tab === 'documents' && isParentForSelectedChild && <DocumentsPanel />}
        {tab === 'packing' && isParentForSelectedChild && <PackingPanel />}
        {tab === 'contacts' && (isParentForSelectedChild || isCollaboratorForSelectedChild) && <ContactsPanel />}
        {tab === 'medications' && (isParentForSelectedChild || isCollaboratorForSelectedChild) && <MedicationsPanel />}
        {tab === 'stats' && isParentForSelectedChild && <StatsPanel />}
        {tab === 'settings' && <><div className="page-title">Configuración</div><SettingsPanel /></>}
        {tab === 'blocks' && isParentForSelectedChild && <BlocksScreen navigate={navigate} />}
      </main>

      <nav className="bottom-nav" onClick={e => e.stopPropagation()}>
        {bottomTabs.map(item => {
          const active = item.id === 'more' ? isMoreArea(tab) : tab === item.id
          return (
            <button key={item.id} className={`nav-btn ${active ? 'active' : ''}`} onClick={() => navigate(item.id)}>
              <img src={item.icon} alt="" aria-hidden="true" />
              <span>{item.label}</span>
              {!!item.badge && item.badge > 0 && <span className="nav-badge">{item.badge > 99 ? '99+' : item.badge}</span>}
              {active && <span className="nav-active-line" />}
            </button>
          )
        })}
      </nav>
    </div>
  )
}

function MorePanel({ isParent, isCollaborator, navigate }: { isParent: boolean; isCollaborator: boolean; navigate: (tab: Tab) => void }) {
  const cards: MoreCard[] = isParent ? [
    { id: 'documents', title: 'Documentos', subtitle: 'Archivos seguros y privados', icon: '/nav-icons/notes.svg', tone: '#3B82F6' },
    { id: 'medications', title: 'Medicación', subtitle: 'Tratamientos y tomas', icon: '/shell-icons/medication.svg', tone: '#EC4899' },
    { id: 'contacts', title: 'Contactos', subtitle: 'Personas y datos útiles', icon: '/shell-icons/contacts.svg', tone: '#10B981' },
    { id: 'packing', title: 'Equipaje', subtitle: 'Ropa y objetos importantes', icon: '/shell-icons/packing.svg', tone: '#F59E0B' },
    { id: 'stats', title: 'Estadísticas', subtitle: 'Resumen y evolución', icon: '/shell-icons/stats.svg', tone: '#8B5CF6' },
    { id: 'settings', title: 'Ajustes', subtitle: 'Familia, permisos y configuración', icon: '/shell-icons/settings.svg', tone: '#64748B' },
    { id: 'blocks', title: 'Bloqueos', subtitle: 'Elementos rechazados y limpieza', emoji: '🚫', tone: '#EF4444' },
    { id: 'notes', title: 'Notas', subtitle: 'Avisos y observaciones', icon: '/nav-icons/notes.svg', tone: '#3B82F6' },
  ] : isCollaborator ? [
    { id: 'contacts', title: 'Contactos', subtitle: 'Personas y datos útiles', icon: '/shell-icons/contacts.svg', tone: '#10B981' },
    { id: 'medications', title: 'Medicación', subtitle: 'Tratamientos y tomas', icon: '/shell-icons/medication.svg', tone: '#EC4899' },
    { id: 'settings', title: 'Ajustes', subtitle: 'Cuenta y configuración', icon: '/shell-icons/settings.svg', tone: '#64748B' },
  ] : [
    { id: 'settings', title: 'Ajustes', subtitle: 'Cuenta y configuración', icon: '/shell-icons/settings.svg', tone: '#64748B' },
  ]

  return (
    <section className="more-real-screen more-as-real-tab" aria-label="Más funciones">
      <div className="more-real-grid more-tab-screen-grid">
        {cards.map(card => (
          <button key={card.id} type="button" className="more-real-card" style={{ '--more-tone': card.tone } as CSSProperties} onClick={() => navigate(card.id)}>
            <span className="more-real-card-copy">
              <span className="more-real-card-title">{card.title}</span>
              <span className="more-real-card-subtitle">{card.subtitle}</span>
            </span>
            <span className="more-real-icon-wrap">{card.icon ? <img src={card.icon} alt="" aria-hidden="true" /> : card.emoji}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

function BlocksScreen({ navigate }: { navigate: (tab: Tab) => void }) {
  return (
    <section className="blocks-menu-screen blocks-main-screen" aria-label="Bloqueos y limpieza">
      <div className="blocks-menu-hero">
        <div>
          <div className="blocks-menu-kicker">Más</div>
          <h1 className="blocks-menu-title">Bloqueos</h1>
          <p className="blocks-menu-subtitle">Elementos rechazados, bloqueos de disponibilidad y limpieza.</p>
        </div>
        <button type="button" className="blocks-menu-back" onClick={() => navigate('more')}>Volver</button>
      </div>
      <RejectedItemsCleanupPanel embedded />
    </section>
  )
}
