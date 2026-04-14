'use client'
import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { useDataSubscriptions } from '@/hooks/useDataSubscriptions'
import { CustodyCalendar } from '@/components/calendar/CustodyCalendar'
import { QuickDateQuery } from '@/components/calendar/QuickDateQuery'
import { RequestsList } from '@/components/requests/RequestsList'
import { SettingsPanel } from '@/components/settings/SettingsPanel'
import { NotesPanel } from '@/components/notes/NotesPanel'
import { EventsPanel } from '@/components/events/EventsPanel'
import { PackingPanel } from '@/components/packing/PackingPanel'
import { StatsPanel } from '@/components/stats/StatsPanel'
import { GlobalToasts } from '@/components/ui/GlobalToasts'
import { markNotificationRead } from '@/lib/db'
import type { AppNotification } from '@/types'

type Tab = 'calendar' | 'requests' | 'notes' | 'events' | 'packing' | 'stats' | 'settings'
type SearchResultType = 'child' | 'parent' | 'event' | 'note' | 'request' | 'special_period'
type SearchResult = { id: string; type: SearchResultType; title: string; subtitle: string; childId?: string; date?: string; endDate?: string; targetTab: Tab }
type FocusTarget = { id: string; seq: number } | null
type DraftTarget = { date: string; seq: number } | null

type CalendarNavigateDetail = {
  tab: 'notes' | 'events' | 'requests'
  childId?: string
  date?: string
  focusTargetId?: string
  openComposer?: 'note' | 'event'
}

function inferTargetTab(item: AppNotification): Tab {
  if (item.targetTab) return item.targetTab
  if (item.type === 'pending_request' || item.type === 'event_assignment_pending' || item.type === 'event_assignment_response') return 'requests'
  if (item.type === 'event_reminder') return 'events'
  return 'calendar'
}
function notificationGroupLabel(type: AppNotification['type']) { if (type === 'pending_request') return 'Cambios'; if (type === 'event_assignment_pending' || type === 'event_assignment_response') return 'Asignaciones'; if (type === 'event_reminder') return 'Recordatorios'; return 'Otros' }
function normalizeText(value: string) { return (value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() }
function matchesQuery(query: string, ...fields: Array<string | undefined | null>) { const q = normalizeText(query); if (!q) return true; return fields.some(field => normalizeText(field || '').includes(q)) }
function searchGroupLabel(type: SearchResultType) { if (type === 'event') return 'Eventos'; if (type === 'note') return 'Notas'; if (type === 'request') return 'Cambios'; if (type === 'special_period') return 'Períodos especiales'; if (type === 'child') return 'Menores'; return 'Progenitores' }

export function AppShell() {
  const { user, signOut } = useAuth()
  const { children, selectedChildId, setSelectedChildId, requests, invitations, notes, notifications, setCurrentMonth, setSelectedCalendarDate, events, specialPeriods } = useAppStore()
  const [tab, setTab] = useState<Tab>('calendar')
  const [moreOpen, setMoreOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [queryOpen, setQueryOpen] = useState(false)
  const [notifFilter, setNotifFilter] = useState<'unread' | 'all'>('unread')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFilter, setSearchFilter] = useState<'all' | SearchResultType>('all')
  const [focusTarget, setFocusTarget] = useState<FocusTarget>(null)
  const [noteDraftTarget, setNoteDraftTarget] = useState<DraftTarget>(null)
  const [eventDraftTarget, setEventDraftTarget] = useState<DraftTarget>(null)
  useDataSubscriptions()

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const targetTab = params.get('tab') as Tab | null
    const childId = params.get('childId')
    const date = params.get('date')
    if (childId) setSelectedChildId(childId)
    if (date) { setSelectedCalendarDate(date); setCurrentMonth(new Date(date + 'T12:00:00')) }
    if (targetTab) setTab(targetTab)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = (ev: KeyboardEvent) => { if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 'k') { ev.preventDefault(); setSearchOpen(v => !v) } }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<CalendarNavigateDetail>).detail
      if (!detail) return
      if (detail.childId) setSelectedChildId(detail.childId)
      if (detail.date) {
        setSelectedCalendarDate(detail.date)
        setCurrentMonth(new Date(detail.date + 'T12:00:00'))
      }
      setTab(detail.tab)
      if (detail.focusTargetId) {
        setFocusTarget({ id: detail.focusTargetId, seq: Date.now() })
        setNoteDraftTarget(null)
        setEventDraftTarget(null)
      } else {
        setFocusTarget(null)
      }
      if (detail.openComposer === 'note' && detail.date) {
        setNoteDraftTarget({ date: detail.date, seq: Date.now() })
      } else if (detail.tab !== 'notes' || detail.focusTargetId) {
        setNoteDraftTarget(null)
      }
      if (detail.openComposer === 'event' && detail.date) {
        setEventDraftTarget({ date: detail.date, seq: Date.now() })
      } else if (detail.tab !== 'events' || detail.focusTargetId) {
        setEventDraftTarget(null)
      }
    }
    window.addEventListener('custodia:navigate', handler as EventListener)
    return () => window.removeEventListener('custodia:navigate', handler as EventListener)
  }, [setCurrentMonth, setSelectedCalendarDate, setSelectedChildId])

  const child = useMemo(() => children.find(c => c.id === selectedChildId) ?? null, [children, selectedChildId])
  const pendingReqs = useMemo(() => requests.filter(r => r.status === 'pending' && r.toParentId === user?.uid).length, [requests, user?.uid])
  const unreadNotes = useMemo(() => notes.filter(n => !n.read && n.createdBy !== user?.uid && n.mentionOther).length, [notes, user?.uid])
  const pendingInvitations = useMemo(() => { const myEmail = (user?.email ?? '').trim().toLowerCase(); return invitations.filter(i => i.status === 'pending' && i.toEmail === myEmail).length }, [invitations, user?.email])
  const unreadNotifications = useMemo(() => notifications.filter(n => !n.read).length, [notifications])
  const totalBadge = pendingReqs + pendingInvitations + unreadNotes + unreadNotifications

  const visibleNotifications = useMemo(() => notifFilter === 'unread' ? notifications.filter(n => !n.read) : notifications, [notifications, notifFilter])
  const groupedNotifications = useMemo(() => { const groups: Record<string, AppNotification[]> = {}; for (const item of visibleNotifications) { const key = notificationGroupLabel(item.type); groups[key] ||= []; groups[key].push(item) } return Object.entries(groups) }, [visibleNotifications])

  const allSearchResults = useMemo<SearchResult[]>(() => {
    const results: SearchResult[] = []
    for (const c of children) {
      results.push({ id: `child-${c.id}`, type: 'child', title: c.name, subtitle: `${c.parents.length} progenitor(es)`, childId: c.id, targetTab: 'calendar' })
      for (const pid of c.parents) results.push({ id: `parent-${c.id}-${pid}`, type: 'parent', title: c.parentNames?.[pid] ?? 'Progenitor', subtitle: `${c.name}${pid === user?.uid ? ' · tú' : ''}`, childId: c.id, targetTab: 'settings' })
    }
    for (const event of events) { const childName = children.find(c => c.id === event.childId)?.name ?? 'Menor'; results.push({ id: `event-${event.id}`, type: 'event', title: event.title, subtitle: `${childName} · ${event.date}${event.endDate ? ` → ${event.endDate}` : ''}${event.notes ? ` · ${event.notes}` : ''}`, childId: event.childId, date: event.date, endDate: event.endDate, targetTab: 'events' }) }
    for (const note of notes) { const childName = children.find(c => c.id === note.childId)?.name ?? 'Menor'; const dateLabel = note.type === 'single' ? note.date : `${note.startDate} → ${note.endDate}`; results.push({ id: `note-${note.id}`, type: 'note', title: note.text, subtitle: `${childName} · ${dateLabel || ''} · ${note.createdByName || 'Nota'}`, childId: note.childId, date: note.date || note.startDate || undefined, endDate: note.endDate || undefined, targetTab: 'notes' }) }
    for (const request of requests) { const childName = children.find(c => c.id === request.childId)?.name ?? 'Menor'; const dateLabel = request.type === 'single' ? request.date : `${request.startDate} → ${request.endDate}`; results.push({ id: `request-${request.id}`, type: 'request', title: request.reason || 'Solicitud de cambio', subtitle: `${childName} · ${dateLabel || ''} · ${request.status}`, childId: request.childId, date: request.date || request.startDate || undefined, endDate: request.endDate || undefined, targetTab: 'requests' }) }
    for (const period of specialPeriods) { const childName = children.find(c => c.id === period.childId)?.name ?? 'Menor'; const label = period.label === 'otro' ? (period.customLabel || 'Período especial') : period.label; const ownerName = children.find(c => c.id === period.childId)?.parentNames?.[period.parentId] ?? 'Progenitor'; results.push({ id: `special-${period.id}`, type: 'special_period', title: label, subtitle: `${childName} · ${period.startDate} → ${period.endDate} · ${ownerName}`, childId: period.childId, date: period.startDate, endDate: period.endDate, targetTab: 'settings' }) }
    return results
  }, [children, events, notes, requests, specialPeriods, user?.uid])

  const filteredSearchResults = useMemo(() => allSearchResults.filter(result => (searchFilter === 'all' || result.type === searchFilter) && matchesQuery(searchQuery.trim(), result.title, result.subtitle)).slice(0, 50), [allSearchResults, searchQuery, searchFilter])
  const groupedSearchResults = useMemo(() => { const groups: Record<string, SearchResult[]> = {}; for (const item of filteredSearchResults) { const key = searchGroupLabel(item.type); groups[key] ||= []; groups[key].push(item) } return Object.entries(groups) }, [filteredSearchResults])

  const mainTabs = [
    { id: 'calendar' as Tab, label: 'Calendario', icon: '/nav-icons/calendar.svg' },
    { id: 'requests' as Tab, label: 'Cambios', icon: '/nav-icons/changes.svg', badge: pendingReqs },
    { id: 'notes' as Tab, label: 'Notas', icon: '/nav-icons/notes.svg', badge: unreadNotes },
    { id: 'events' as Tab, label: 'Eventos', icon: '/nav-icons/events.svg' },
    { id: 'settings' as Tab, label: 'Más', icon: '/nav-icons/more.svg', badge: pendingInvitations },
  ]

  const openNotification = async (item: AppNotification) => { await markNotificationRead(item.id); if (item.childId) setSelectedChildId(item.childId); if (item.targetDate) { setSelectedCalendarDate(item.targetDate); setCurrentMonth(new Date(item.targetDate + 'T12:00:00')) } setTab(inferTargetTab(item)); setNotifOpen(false) }
  const openSearchResult = (item: SearchResult) => {
    if (item.childId) setSelectedChildId(item.childId)
    if (item.date) {
      setSelectedCalendarDate(item.date)
      setCurrentMonth(new Date(item.date + 'T12:00:00'))
    }
    setTab(item.targetTab)
    if (item.type === 'event' || item.type === 'note' || item.type === 'request') setFocusTarget({ id: item.id, seq: Date.now() })
    else setFocusTarget(null)
    setSearchOpen(false)
    setSearchQuery('')
    setSearchFilter('all')
  }
  const markAllVisibleAsRead = async () => { const unread = visibleNotifications.filter(n => !n.read); await Promise.all(unread.map(n => markNotificationRead(n.id))) }
  const handleTabClick = (id: Tab) => { setUserMenuOpen(false); setNotifOpen(false); setQueryOpen(false); if (id === 'settings') { setMoreOpen(v => !v); return } setMoreOpen(false); setTab(id) }
  const activeMore = ['packing', 'stats', 'settings'].includes(tab)

  return (
    <div className="app-shell" onClick={() => { if (moreOpen) setMoreOpen(false); if (userMenuOpen) setUserMenuOpen(false); if (notifOpen) setNotifOpen(false); if (queryOpen) setQueryOpen(false) }}>
      <GlobalToasts />
      <header className="app-header" onClick={e => e.stopPropagation()} style={{ paddingBottom: 8, marginBottom: 4 }}>
        <div style={{ width:'100%', padding:'10px 12px', borderRadius:20, background:'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-soft) 100%)', border:'1px solid var(--border)', boxShadow:'var(--card-shadow)' }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10, flexWrap:'nowrap' }}>
            <div className="app-header-left" style={{ gap:10, flex:1, minWidth:0 }}>
              <img src="/apple-touch-icon.png?v=4" alt="Custodia" className="app-logo" style={{ width:36, height:36, borderRadius:12, boxShadow:'var(--card-shadow)', objectFit:'cover' }} />
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight:800, textTransform:'uppercase', letterSpacing:0.45, marginBottom:1 }}>Familia organizada</div>
                <div className="app-title" style={{ fontSize:19, lineHeight:1.1 }}>CustodiaApp</div>
                <div style={{ display:'flex', alignItems:'center', gap:6, position:'relative', marginTop:2, minWidth:0 }}>
                  {child && <div className="app-subtitle" style={{ fontSize:12, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{child.name}</div>}
                  <div style={{ position:'relative', flexShrink:0 }}>
                    <button onClick={() => { setMoreOpen(false); setUserMenuOpen(false); setNotifOpen(false); setQueryOpen(v => !v) }} title="Consulta rápida" style={{ width:20, height:20, borderRadius:'50%', border:'1px solid var(--border-hover)', background:'var(--bg-card)', color:'var(--text-secondary)', fontSize:11, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>?</button>
                    {queryOpen && (
                      <div className="header-popup-menu" style={{ position:'fixed', top:74, left:16, right:16, width:'auto', maxWidth:320, margin:'0 auto', padding:0, overflow:'hidden' }}>
                        <QuickDateQuery />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display:'flex', alignItems:'flex-start', gap:6, position:'relative', flexWrap:'nowrap', justifyContent:'flex-end', marginLeft:8, flexShrink:0 }}>
              <button onClick={() => { setMoreOpen(false); setUserMenuOpen(false); setNotifOpen(false); setQueryOpen(false); setSearchOpen(true) }} title="Buscar" style={{ height:34, width:34, borderRadius:12, border:'1px solid var(--border-hover)', background:'var(--bg-card)', color:'var(--text-secondary)', cursor:'pointer', padding:0, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'var(--card-shadow)', flexShrink:0 }}><span>🔎</span></button>
              {children.length > 1 && <select value={selectedChildId ?? ''} onChange={e => setSelectedChildId(e.target.value)} style={{ maxWidth:92, background:'var(--bg-card)', border:'1px solid var(--border-hover)', borderRadius:12, padding:'7px 10px', color:'var(--text-strong)', fontSize:11, outline:'none', boxShadow:'var(--card-shadow)', flexShrink:1 }}><option value={selectedChildId ?? ''}>{children.find(c => c.id === selectedChildId)?.name ?? 'Menor'}</option>{children.filter(c => c.id !== selectedChildId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
              <div style={{ position: 'relative', flexShrink:0 }}>
                <button className="notif-btn" onClick={() => { setMoreOpen(false); setUserMenuOpen(false); setQueryOpen(false); setNotifOpen(v => !v) }} style={{ width:34, height:34, borderRadius:12, background:'var(--bg-card)', border:'1px solid var(--border-hover)' }}>🔔{totalBadge > 0 ? <span className="notif-count">{totalBadge}</span> : null}</button>
              </div>
              <div style={{ position: 'relative', flexShrink:0 }}>
                <button className="user-avatar" onClick={() => { setMoreOpen(false); setNotifOpen(false); setQueryOpen(false); setUserMenuOpen(v => !v) }} title="Usuario" style={{ width:34, height:34, borderRadius:12 }}>{user?.photoURL ? <img src={user.photoURL} alt="" /> : (user?.displayName ?? user?.email ?? 'U')[0].toUpperCase()}</button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="app-main" onClick={e => e.stopPropagation()}>
        {tab === 'calendar'  && <CustodyCalendar />}
        {tab === 'requests'  && <RequestsList focusTargetId={focusTarget?.id} focusSeq={focusTarget?.seq} />}
        {tab === 'notes'     && <NotesPanel focusTargetId={focusTarget?.id} focusSeq={focusTarget?.seq} initialCreateDate={noteDraftTarget?.date} createSeq={noteDraftTarget?.seq} />}
        {tab === 'events'    && <EventsPanel focusTargetId={focusTarget?.id} focusSeq={focusTarget?.seq} initialCreateDate={eventDraftTarget?.date} createSeq={eventDraftTarget?.seq} />}
        {tab === 'packing'   && <PackingPanel />}
        {tab === 'stats'     && <StatsPanel />}
        {tab === 'settings'  && <><div className="page-title">Configuración</div><SettingsPanel /></>}
      </main>
    </div>
  )
}
