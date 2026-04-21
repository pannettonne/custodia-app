'use client'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { useDataSubscriptions } from '@/hooks/useDataSubscriptions'
import { CustodyCalendar } from '@/components/calendar/CustodyCalendar'
import { QuickDateQuery } from '@/components/calendar/QuickDateQuery'
import { RequestsList } from '@/components/requests/RequestsList'
import { SettingsPanel } from '@/components/settings/SettingsPanel'
import { NotesPanel } from '@/components/notes/NotesPanel'
import { EventsPanel } from '@/components/events/EventsPanel'
import { DocumentsPanel } from '@/components/documents/DocumentsPanel'
import { PackingPanel } from '@/components/packing/PackingPanel'
import { StatsPanel } from '@/components/stats/StatsPanel'
import { GlobalToasts } from '@/components/ui/GlobalToasts'
import { markNotificationRead } from '@/lib/db'
import type { AppNotification } from '@/types'

type Tab = 'calendar' | 'requests' | 'notes' | 'events' | 'documents' | 'packing' | 'stats' | 'settings'
type SearchResultType = 'child' | 'parent' | 'event' | 'note' | 'request' | 'special_period' | 'document' | 'document_folder'
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

const HEADER_SEARCH_ICON = '/shell-icons/search.svg'
const HEADER_BELL_ICON = '/shell-icons/bell.svg'
const MORE_DOCUMENTS_ICON = '/nav-icons/notes.svg'
const MORE_PACKING_ICON = '/shell-icons/packing.svg'
const MORE_STATS_ICON = '/shell-icons/stats.svg'
const MORE_SETTINGS_ICON = '/shell-icons/settings.svg'

function inferTargetTab(item: AppNotification): Tab {
  if (item.targetTab) return item.targetTab as Tab
  if (item.type === 'pending_request' || item.type === 'event_assignment_pending' || item.type === 'event_assignment_response') return 'requests'
  if (item.type === 'event_reminder') return 'events'
  return 'calendar'
}
function notificationGroupLabel(type: AppNotification['type']) { if (type === 'pending_request') return 'Cambios'; if (type === 'event_assignment_pending' || type === 'event_assignment_response') return 'Asignaciones'; if (type === 'event_reminder') return 'Recordatorios'; return 'Otros' }
function normalizeText(value: string) { return (value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() }
function matchesQuery(query: string, ...fields: Array<string | undefined | null>) { const q = normalizeText(query); if (!q) return true; return fields.some(field => normalizeText(field || '').includes(q)) }
function searchGroupLabel(type: SearchResultType) { if (type === 'event') return 'Eventos'; if (type === 'note') return 'Notas'; if (type === 'request') return 'Cambios'; if (type === 'special_period') return 'Períodos especiales'; if (type === 'document') return 'Documentos'; if (type === 'document_folder') return 'Carpetas'; if (type === 'child') return 'Menores'; return 'Progenitores' }

export function AppShell() {
  const { user, signOut } = useAuth()
  const { children, selectedChildId, setSelectedChildId, requests, collaboratorAssignments, invitations, notes, notifications, setCurrentMonth, setSelectedCalendarDate, events, specialPeriods, documents, documentFolders } = useAppStore()
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
      if (detail.focusTargetId) setFocusTarget({ id: detail.focusTargetId, seq: Date.now() })
      if (detail.openComposer === 'note' && detail.date) setNoteDraftTarget({ date: detail.date, seq: Date.now() })
      if (detail.openComposer === 'event' && detail.date) setEventDraftTarget({ date: detail.date, seq: Date.now() })
    }
    window.addEventListener('custodia:navigate', handler as EventListener)
    return () => window.removeEventListener('custodia:navigate', handler as EventListener)
  }, [setCurrentMonth, setSelectedCalendarDate, setSelectedChildId])

  const child = useMemo(() => children.find(c => c.id === selectedChildId) ?? null, [children, selectedChildId])
  const isParentForSelectedChild = !!child && !!user?.uid && child.parents.includes(user.uid)
  const isCollaboratorForSelectedChild = !!child && !!user?.uid && !!child.collaborators?.includes(user.uid)
  const allowedTabs: Tab[] = isParentForSelectedChild
    ? ['calendar', 'requests', 'notes', 'events', 'documents', 'packing', 'stats', 'settings']
    : isCollaboratorForSelectedChild
      ? ['calendar', 'requests', 'settings']
      : ['calendar', 'settings']

  useEffect(() => {
    if (!allowedTabs.includes(tab)) {
      setTab('calendar')
      setMoreOpen(false)
    }
  }, [tab, allowedTabs.join('|')])

  const pendingReqs = useMemo(() => {
    if (!user?.uid) return 0
    const incomingChanges = isParentForSelectedChild ? requests.filter(r => r.status === 'pending' && r.toParentId === user.uid).length : 0
    const incomingCollaboratorAssignments = collaboratorAssignments.filter(a => a.status === 'pending' && ((isParentForSelectedChild && a.createdByParentId === user.uid) || (isCollaboratorForSelectedChild && a.collaboratorId === user.uid))).length
    return incomingChanges + incomingCollaboratorAssignments
  }, [requests, collaboratorAssignments, user?.uid, isParentForSelectedChild, isCollaboratorForSelectedChild])
  const unreadNotes = useMemo(() => isParentForSelectedChild ? notes.filter(n => !n.read && n.createdBy !== user?.uid && n.mentionOther).length : 0, [notes, user?.uid, isParentForSelectedChild])
  const pendingInvitations = useMemo(() => { const myEmail = (user?.email ?? '').trim().toLowerCase(); return invitations.filter(i => i.status === 'pending' && i.toEmail === myEmail).length }, [invitations, user?.email])
  const unreadNotifications = useMemo(() => notifications.filter(n => !n.read).length, [notifications])
  const totalBadge = pendingReqs + pendingInvitations + unreadNotes + unreadNotifications

  const visibleNotifications = useMemo(() => notifFilter === 'unread' ? notifications.filter(n => !n.read) : notifications, [notifications, notifFilter])
  const groupedNotifications = useMemo(() => { const groups: Record<string, AppNotification[]> = {}; for (const item of visibleNotifications) { const key = notificationGroupLabel(item.type); groups[key] ||= []; groups[key].push(item) } return Object.entries(groups) }, [visibleNotifications])

  const allSearchResults = useMemo<SearchResult[]>(() => {
    const results: SearchResult[] = []
    for (const c of children) {
      const isParentForChild = !!user?.uid && c.parents.includes(user.uid)
      results.push({ id: `child-${c.id}`, type: 'child', title: c.name, subtitle: isParentForChild ? `${c.parents.length} progenitor(es)` : 'Colaborador', childId: c.id, targetTab: 'calendar' })
      for (const pid of c.parents) results.push({ id: `parent-${c.id}-${pid}`, type: 'parent', title: c.parentNames?.[pid] ?? 'Progenitor', subtitle: `${c.name}${pid === user?.uid ? ' · tú' : ''}`, childId: c.id, targetTab: 'settings' })
    }
    if (isParentForSelectedChild) {
      for (const event of events) { const childName = children.find(c => c.id === event.childId)?.name ?? 'Menor'; results.push({ id: `event-${event.id}`, type: 'event', title: event.title, subtitle: `${childName} · ${event.date}${event.endDate ? ` → ${event.endDate}` : ''}${event.notes ? ` · ${event.notes}` : ''}`, childId: event.childId, date: event.date, endDate: event.endDate, targetTab: 'events' }) }
      for (const note of notes) { const childName = children.find(c => c.id === note.childId)?.name ?? 'Menor'; const dateLabel = note.type === 'single' ? note.date : `${note.startDate} → ${note.endDate}`; results.push({ id: `note-${note.id}`, type: 'note', title: note.text, subtitle: `${childName} · ${dateLabel || ''} · ${note.createdByName || 'Nota'}`, childId: note.childId, date: note.date || note.startDate || undefined, endDate: note.endDate || undefined, targetTab: 'notes' }) }
      for (const request of requests) { const childName = children.find(c => c.id === request.childId)?.name ?? 'Menor'; const dateLabel = request.type === 'single' ? request.date : `${request.startDate} → ${request.endDate}`; results.push({ id: `request-${request.id}`, type: 'request', title: request.reason || 'Solicitud de cambio', subtitle: `${childName} · ${dateLabel || ''} · ${request.status}`, childId: request.childId, date: request.date || request.startDate || undefined, endDate: request.endDate || undefined, targetTab: 'requests' }) }
      for (const period of specialPeriods) { const childName = children.find(c => c.id === period.childId)?.name ?? 'Menor'; const label = period.label === 'otro' ? (period.customLabel || 'Período especial') : period.label; const ownerName = children.find(c => c.id === period.childId)?.parentNames?.[period.parentId] ?? 'Progenitor'; results.push({ id: `special-${period.id}`, type: 'special_period', title: label, subtitle: `${childName} · ${period.startDate} → ${period.endDate} · ${ownerName}`, childId: period.childId, date: period.startDate, endDate: period.endDate, targetTab: 'settings' }) }
      for (const folder of documentFolders) {
        const childName = children.find(c => c.id === folder.childId)?.name ?? 'Menor'
        results.push({ id: `document_folder-${folder.id}`, type: 'document_folder', title: folder.name, subtitle: `${childName} · carpeta`, childId: folder.childId, targetTab: 'documents' })
      }
      for (const document of documents) {
        const childName = children.find(c => c.id === document.childId)?.name ?? 'Menor'
        const folderName = document.folderId ? documentFolders.find(folder => folder.id === document.folderId)?.name : 'Sin carpeta'
        results.push({ id: `document-${document.id}`, type: 'document', title: document.title || 'Documento cifrado', subtitle: `${childName} · ${folderName} · ${document.shareScope === 'only_me' ? 'Solo para mí' : 'Para todos'}`, childId: document.childId, targetTab: 'documents' })
      }
    }
    return results
  }, [children, events, notes, requests, specialPeriods, user?.uid, documents, documentFolders, isParentForSelectedChild])

  const filteredSearchResults = useMemo(() => allSearchResults.filter(result => (searchFilter === 'all' || result.type === searchFilter) && matchesQuery(searchQuery.trim(), result.title, result.subtitle)).slice(0, 50), [allSearchResults, searchQuery, searchFilter])
  const groupedSearchResults = useMemo(() => { const groups: Record<string, SearchResult[]> = {}; for (const item of filteredSearchResults) { const key = searchGroupLabel(item.type); groups[key] ||= []; groups[key].push(item) } return Object.entries(groups) }, [filteredSearchResults])

  const mainTabs = isParentForSelectedChild ? [
    { id: 'calendar' as Tab, label: 'Calendario', icon: '/nav-icons/calendar.svg' },
    { id: 'requests' as Tab, label: 'Cambios', icon: '/nav-icons/changes.svg', badge: pendingReqs },
    { id: 'notes' as Tab, label: 'Notas', icon: '/nav-icons/notes.svg', badge: unreadNotes },
    { id: 'events' as Tab, label: 'Eventos', icon: '/nav-icons/events.svg' },
    { id: 'settings' as Tab, label: 'Más', icon: '/nav-icons/more.svg', badge: pendingInvitations },
  ] : isCollaboratorForSelectedChild ? [
    { id: 'calendar' as Tab, label: 'Calendario', icon: '/nav-icons/calendar.svg' },
    { id: 'requests' as Tab, label: 'Cambios', icon: '/nav-icons/changes.svg', badge: pendingReqs },
    { id: 'settings' as Tab, label: 'Más', icon: '/nav-icons/more.svg', badge: pendingInvitations },
  ] : [
    { id: 'calendar' as Tab, label: 'Calendario', icon: '/nav-icons/calendar.svg' },
    { id: 'settings' as Tab, label: 'Más', icon: '/nav-icons/more.svg', badge: pendingInvitations },
  ]

  const openNotification = async (item: AppNotification) => { await markNotificationRead(item.id); if (item.childId) setSelectedChildId(item.childId); if (item.targetDate) { setSelectedCalendarDate(item.targetDate); setCurrentMonth(new Date(item.targetDate + 'T12:00:00')) } const nextTab = inferTargetTab(item); setTab(allowedTabs.includes(nextTab) ? nextTab : 'calendar'); setNotifOpen(false) }
  const openSearchResult = (item: SearchResult) => {
    if (item.childId) setSelectedChildId(item.childId)
    if (item.date) {
      setSelectedCalendarDate(item.date)
      setCurrentMonth(new Date(item.date + 'T12:00:00'))
    }
    setTab(allowedTabs.includes(item.targetTab) ? item.targetTab : 'calendar')
    if (item.type === 'event' || item.type === 'note' || item.type === 'request') setFocusTarget({ id: item.id, seq: Date.now() })
    else setFocusTarget(null)
    setSearchOpen(false)
    setSearchQuery('')
    setSearchFilter('all')
  }
  const markAllVisibleAsRead = async () => { const unread = visibleNotifications.filter(n => !n.read); await Promise.all(unread.map(n => markNotificationRead(n.id))) }
  const handleTabClick = (id: Tab) => { if (!allowedTabs.includes(id)) return; setUserMenuOpen(false); setNotifOpen(false); setQueryOpen(false); if (id === 'settings') { setMoreOpen(v => !v); return } setMoreOpen(false); setTab(id) }
  const activeMore = ['documents', 'packing', 'stats', 'settings'].includes(tab)
  const visibleMoreItems = isParentForSelectedChild ? [
    { id: 'documents' as Tab, label: 'Documentos', icon: MORE_DOCUMENTS_ICON },
    { id: 'packing' as Tab, label: 'Equipaje', icon: MORE_PACKING_ICON },
    { id: 'stats' as Tab, label: 'Estadísticas', icon: MORE_STATS_ICON },
    { id: 'settings' as Tab, label: 'Ajustes', icon: MORE_SETTINGS_ICON },
  ] : [
    { id: 'settings' as Tab, label: 'Ajustes', icon: MORE_SETTINGS_ICON },
  ]

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
                  {child && <div className="app-subtitle" style={{ fontSize:12, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{child.name}{isCollaboratorForSelectedChild && !isParentForSelectedChild ? ' · colaborador' : ''}</div>}
                  <div style={{ position:'relative', flexShrink:0 }}>
                    <button onClick={() => { setMoreOpen(false); setUserMenuOpen(false); setNotifOpen(false); setQueryOpen(v => !v) }} title="Consulta rápida" style={{ width:20, height:20, borderRadius:'50%', border:'1px solid var(--border-hover)', background:'var(--bg-card)', color:'var(--text-secondary)', fontSize:11, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>?</button>
                    {queryOpen && <div className="header-popup-menu" style={{ position:'fixed', top:74, left:16, right:16, width:'auto', maxWidth:320, margin:'0 auto', padding:0, overflow:'hidden' }}><QuickDateQuery /></div>}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display:'flex', alignItems:'flex-start', gap:6, position:'relative', flexWrap:'nowrap', justifyContent:'flex-end', marginLeft:8, flexShrink:0 }}>
              <button onClick={() => { setMoreOpen(false); setUserMenuOpen(false); setNotifOpen(false); setQueryOpen(false); setSearchOpen(true) }} title="Buscar" style={{ height:34, width:34, borderRadius:12, border:'1px solid var(--border-hover)', background:'var(--bg-card)', color:'var(--text-secondary)', cursor:'pointer', padding:0, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'var(--card-shadow)', flexShrink:0 }}><img src={HEADER_SEARCH_ICON} alt="" aria-hidden="true" style={{ width:18, height:18, objectFit:'contain' }} /></button>
              {children.length > 1 && <select value={selectedChildId ?? ''} onChange={e => setSelectedChildId(e.target.value)} style={{ maxWidth:120, background:'var(--bg-card)', border:'1px solid var(--border-hover)', borderRadius:12, padding:'7px 10px', color:'var(--text-strong)', fontSize:11, outline:'none', boxShadow:'var(--card-shadow)', flexShrink:1 }}><option value={selectedChildId ?? ''}>{children.find(c => c.id === selectedChildId)?.name ?? 'Menor'}</option>{children.filter(c => c.id !== selectedChildId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
              <div style={{ position:'relative', flexShrink:0 }}>
                <button className="notif-btn" onClick={() => { setMoreOpen(false); setUserMenuOpen(false); setQueryOpen(false); setNotifOpen(v => !v) }} style={{ width:34, height:34, borderRadius:12, background:'var(--bg-card)', border:'1px solid var(--border-hover)', display:'flex', alignItems:'center', justifyContent:'center' }}><img src={HEADER_BELL_ICON} alt="" aria-hidden="true" style={{ width:18, height:18, objectFit:'contain' }} />{totalBadge > 0 ? <span className="notif-count">{totalBadge}</span> : null}</button>
                {notifOpen && <div className="header-popup-menu notifications-popup-menu" style={{ right:0, left:'auto', width:'min(300px, calc(100vw - 28px))', maxHeight:'70vh', overflow:'auto' }}><div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, marginBottom:8 }}><div className="popup-menu-label" style={{ margin:0, borderBottom:'none', padding:'0 0 0 2px' }}>Avisos</div><button className="popup-menu-item" style={{ width:'auto', padding:'6px 10px' }} onClick={markAllVisibleAsRead}>Leer todo</button></div><div style={{ display:'flex', gap:6, marginBottom:10 }}><button className="popup-menu-item" style={{ flex:1, justifyContent:'center', textAlign:'center', background: notifFilter === 'unread' ? 'var(--bg-soft)' : 'transparent' }} onClick={() => setNotifFilter('unread')}>No leídos</button><button className="popup-menu-item" style={{ flex:1, justifyContent:'center', textAlign:'center', background: notifFilter === 'all' ? 'var(--bg-soft)' : 'transparent' }} onClick={() => setNotifFilter('all')}>Todos</button></div>{groupedNotifications.length === 0 ? <div className="popup-empty">No hay avisos en esta vista.</div> : groupedNotifications.map(([group, items]) => <div key={group} style={{ marginBottom:10 }}><div style={{ fontSize:11, fontWeight:800, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:0.4, marginBottom:6, padding:'0 4px' }}>{group}</div>{items.map(item => <button key={item.id} className="notification-item" onClick={() => openNotification(item)}><div className="notification-item-title">{item.title}</div><div className="notification-item-body">{item.body}</div>{!item.read && <div className="notification-item-dot" />}</button>)}</div>)}</div>}
              </div>
              <div style={{ position:'relative', flexShrink:0 }}>
                <button className="user-avatar" onClick={() => { setMoreOpen(false); setNotifOpen(false); setQueryOpen(false); setUserMenuOpen(v => !v) }} title="Usuario" style={{ width:34, height:34, borderRadius:12 }}>{user?.photoURL ? <img src={user.photoURL} alt="" /> : (user?.displayName ?? user?.email ?? 'U')[0].toUpperCase()}</button>
                {userMenuOpen && <div className="header-popup-menu user-popup-menu" style={{ right:0, left:'auto', width:'min(220px, calc(100vw - 28px))' }}><div className="popup-menu-label">{user?.displayName ?? user?.email}</div><button className="popup-menu-item danger" onClick={signOut}>Cerrar sesión</button></div>}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="app-main" onClick={e => e.stopPropagation()}>
        {tab === 'calendar' && <CustodyCalendar />}
        {tab === 'requests' && (isParentForSelectedChild || isCollaboratorForSelectedChild) && <RequestsList focusTargetId={focusTarget?.id} focusSeq={focusTarget?.seq} />}
        {tab === 'notes' && isParentForSelectedChild && <NotesPanel focusTargetId={focusTarget?.id} focusSeq={focusTarget?.seq} initialCreateDate={noteDraftTarget?.date} createSeq={noteDraftTarget?.seq} />}
        {tab === 'events' && isParentForSelectedChild && <EventsPanel focusTargetId={focusTarget?.id} focusSeq={focusTarget?.seq} initialCreateDate={eventDraftTarget?.date} createSeq={eventDraftTarget?.seq} />}
        {tab === 'documents' && isParentForSelectedChild && <DocumentsPanel />}
        {tab === 'packing' && isParentForSelectedChild && <PackingPanel />}
        {tab === 'stats' && isParentForSelectedChild && <StatsPanel />}
        {tab === 'settings' && <><div className="page-title">Configuración</div><SettingsPanel /></>}
      </main>

      {searchOpen && <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:90, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'70px 14px 14px' }} onClick={() => setSearchOpen(false)}><div className="card" style={{ width:'100%', maxWidth:680, maxHeight:'80vh', overflow:'auto', padding:14 }} onClick={e => e.stopPropagation()}><div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}><input autoFocus value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar en eventos, notas, documentos, carpetas..." className="settings-input" style={{ marginBottom:0 }} /><button className="btn-primary btn-outline" style={{ padding:'10px 12px' }} onClick={() => setSearchOpen(false)}>Cerrar</button></div><div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:4, marginBottom:10, flexWrap:'wrap' }}>{[['all','Todo'],['event','Eventos'],['note','Notas'],['request','Cambios'],['document','Documentos'],['document_folder','Carpetas'],['special_period','Períodos'],['child','Menores'],['parent','Progenitores']].map(([value, label]) => <button key={value} onClick={() => setSearchFilter(value as any)} style={{ padding:'6px 10px', borderRadius:999, border:`1px solid ${searchFilter === value ? 'var(--text-strong)' : 'var(--border)'}`, background: searchFilter === value ? 'var(--bg-soft)' : 'transparent', color:'var(--text-secondary)', fontSize:11, fontWeight:700, cursor:'pointer' }}>{label}</button>)}</div>{groupedSearchResults.length === 0 ? <div className="popup-empty">No hay resultados para esa búsqueda.</div> : groupedSearchResults.map(([group, items]) => <div key={group} style={{ marginBottom:12 }}><div style={{ fontSize:11, fontWeight:800, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:0.4, marginBottom:6 }}>{group}</div><div style={{ display:'grid', gap:6 }}>{items.map(item => <button key={item.id} className="notification-item" onClick={() => openSearchResult(item)} style={{ textAlign:'left' }}><div className="notification-item-title">{item.title}</div><div className="notification-item-body">{item.subtitle}</div></button>)}</div></div>)}</div></div>}

      {moreOpen && <div className="floating-more-menu" onClick={e => e.stopPropagation()}>{visibleMoreItems.map(({ id, label, icon }) => <button key={id} className={`floating-more-item ${tab===id ? 'active' : ''}`} onClick={() => { setTab(id); setMoreOpen(false) }} style={{ display:'flex', alignItems:'center', gap:10 }}><img src={icon} alt="" aria-hidden="true" style={{ width:20, height:20, objectFit:'contain', flexShrink:0 }} /><span>{label}</span></button>)}</div>}

      <nav className="bottom-nav" onClick={e => e.stopPropagation()}>
        {mainTabs.map(({ id, label, icon, badge }) => {
          const isActive = tab === id || (id === 'settings' && activeMore)
          return <button key={id} className={`nav-btn ${isActive ? 'active' : ''}`} onClick={() => handleTabClick(id)}><img src={icon} alt="" aria-hidden="true" style={{ width:24, height:24, objectFit:'contain', opacity:isActive ? 1 : 0.92 }} /><span>{label}</span>{badge && badge > 0 ? <span className="nav-badge">{badge}</span> : null}{isActive && <span className="nav-active-line" />}</button>
        })}
      </nav>
    </div>
  )
}
