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
import { markNotificationRead } from '@/lib/db'
import type { AppNotification } from '@/types'

type Tab = 'calendar' | 'requests' | 'notes' | 'events' | 'packing' | 'stats' | 'settings'
type SearchResultType = 'child' | 'parent' | 'event' | 'note' | 'request' | 'special_period'
type SearchResult = { id: string; type: SearchResultType; title: string; subtitle: string; childId?: string; date?: string; endDate?: string; targetTab: Tab }

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

  const mainTabs = [ { id: 'calendar' as Tab, label: 'Calendario', emoji: '📅' }, { id: 'requests' as Tab, label: 'Cambios', emoji: '🔄', badge: pendingReqs }, { id: 'notes' as Tab, label: 'Notas', emoji: '📝', badge: unreadNotes }, { id: 'events' as Tab, label: 'Eventos', emoji: '🎓' }, { id: 'settings' as Tab, label: 'Más', emoji: '⋯', badge: pendingInvitations } ]

  const openNotification = async (item: AppNotification) => { await markNotificationRead(item.id); if (item.childId) setSelectedChildId(item.childId); if (item.targetDate) { setSelectedCalendarDate(item.targetDate); setCurrentMonth(new Date(item.targetDate + 'T12:00:00')) } setTab(inferTargetTab(item)); setNotifOpen(false) }
  const openSearchResult = (item: SearchResult) => { if (item.childId) setSelectedChildId(item.childId); if (item.date) { setSelectedCalendarDate(item.date); setCurrentMonth(new Date(item.date + 'T12:00:00')) } setTab(item.targetTab); setSearchOpen(false); setSearchQuery(''); setSearchFilter('all') }
  const markAllVisibleAsRead = async () => { const unread = visibleNotifications.filter(n => !n.read); await Promise.all(unread.map(n => markNotificationRead(n.id))) }
  const handleTabClick = (id: Tab) => { setUserMenuOpen(false); setNotifOpen(false); setQueryOpen(false); if (id === 'settings') { setMoreOpen(v => !v); return } setMoreOpen(false); setTab(id) }
  const activeMore = ['packing', 'stats', 'settings'].includes(tab)

  return (
    <div className="app-shell" onClick={() => { if (moreOpen) setMoreOpen(false); if (userMenuOpen) setUserMenuOpen(false); if (notifOpen) setNotifOpen(false); if (queryOpen) setQueryOpen(false) }}>
      <header className="app-header" onClick={e => e.stopPropagation()} style={{ paddingBottom: 8, marginBottom: 4 }}>
        <div style={{ width:'100%', padding:'10px 12px', borderRadius:20, background:'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-soft) 100%)', border:'1px solid var(--border)', boxShadow:'var(--card-shadow)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, flexWrap:'wrap' }}>
            <div className="app-header-left" style={{ gap:10 }}>
              <img src="/apple-touch-icon.png?v=4" alt="Custodia" className="app-logo" style={{ width:36, height:36, borderRadius:12, boxShadow:'var(--card-shadow)', objectFit:'cover' }} />
              <div>
                <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight:800, textTransform:'uppercase', letterSpacing:0.45, marginBottom:1 }}>Familia organizada</div>
                <div className="app-title" style={{ fontSize:19, lineHeight:1.1 }}>CustodiaApp</div>
                <div style={{ display:'flex', alignItems:'center', gap:6, position:'relative', marginTop:2 }}>
                  {child && <div className="app-subtitle" style={{ fontSize:12 }}>{child.name}</div>}
                  <div style={{ position:'relative' }}>
                    <button onClick={() => { setMoreOpen(false); setUserMenuOpen(false); setNotifOpen(false); setQueryOpen(v => !v) }} title="Consulta rápida" style={{ width:20, height:20, borderRadius:'50%', border:'1px solid var(--border-hover)', background:'var(--bg-card)', color:'var(--text-secondary)', fontSize:11, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>?</button>
                    {queryOpen && <div className="header-popup-menu" style={{ left:0, right:'auto', minWidth:300, padding:0, overflow:'hidden' }}><QuickDateQuery /></div>}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative', flexWrap:'wrap', justifyContent:'flex-end' }}>
              <button onClick={() => { setMoreOpen(false); setUserMenuOpen(false); setNotifOpen(false); setQueryOpen(false); setSearchOpen(true) }} title="Buscar" style={{ height:34, width:34, borderRadius:12, border:'1px solid var(--border-hover)', background:'var(--bg-card)', color:'var(--text-secondary)', cursor:'pointer', padding:0, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'var(--card-shadow)' }}><span>🔎</span></button>
              {children.length > 1 && <select value={selectedChildId ?? ''} onChange={e => setSelectedChildId(e.target.value)} style={{ background:'var(--bg-card)', border:'1px solid var(--border-hover)', borderRadius:12, padding:'7px 10px', color:'var(--text-strong)', fontSize:11, outline:'none', boxShadow:'var(--card-shadow)' }}>{children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
              <div style={{ position: 'relative' }}>
                <button className="notif-btn" onClick={() => { setMoreOpen(false); setUserMenuOpen(false); setQueryOpen(false); setNotifOpen(v => !v) }} style={{ width:34, height:34, borderRadius:12, background:'var(--bg-card)', border:'1px solid var(--border-hover)' }}>🔔{totalBadge > 0 ? <span className="notif-count">{totalBadge}</span> : null}</button>
                {notifOpen && <div className="header-popup-menu notifications-popup-menu" style={{ width: 340, maxHeight: '70vh', overflow: 'auto' }}><div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, marginBottom:8 }}><div className="popup-menu-label" style={{ margin:0 }}>Avisos</div><button className="popup-menu-item" style={{ padding:'4px 8px' }} onClick={markAllVisibleAsRead}>Marcar todo leído</button></div><div style={{ display:'flex', gap:6, marginBottom:10 }}><button className="popup-menu-item" style={{ flex:1, justifyContent:'center', background: notifFilter === 'unread' ? 'var(--bg-soft)' : 'transparent' }} onClick={() => setNotifFilter('unread')}>No leídos</button><button className="popup-menu-item" style={{ flex:1, justifyContent:'center', background: notifFilter === 'all' ? 'var(--bg-soft)' : 'transparent' }} onClick={() => setNotifFilter('all')}>Todos</button></div>{groupedNotifications.length === 0 ? <div className="popup-empty">No hay avisos en esta vista.</div> : groupedNotifications.map(([group, items]) => <div key={group} style={{ marginBottom:10 }}><div style={{ fontSize:11, fontWeight:800, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:0.4, marginBottom:6 }}>{group}</div>{items.map(item => <button key={item.id} className="notification-item" onClick={() => openNotification(item)}><div className="notification-item-title">{item.title}</div><div className="notification-item-body">{item.body}</div>{!item.read && <div className="notification-item-dot" />}</button>)}</div>)}{(pendingReqs > 0 || unreadNotes > 0 || pendingInvitations > 0) && <div style={{ borderTop:'1px solid var(--border)', marginTop:8, paddingTop:8, display:'flex', flexDirection:'column', gap:4 }}>{pendingReqs > 0 && <button className="popup-menu-item" onClick={() => { setTab('requests'); setNotifOpen(false) }}>Ver solicitudes pendientes</button>}{unreadNotes > 0 && <button className="popup-menu-item" onClick={() => { setTab('notes'); setNotifOpen(false) }}>Ver notas no leídas</button>}{pendingInvitations > 0 && <button className="popup-menu-item" onClick={() => { setTab('settings'); setNotifOpen(false) }}>Ver invitaciones pendientes</button>}</div>}</div>}
              </div>
              <div style={{ position: 'relative' }}>
                <button className="user-avatar" onClick={() => { setMoreOpen(false); setNotifOpen(false); setQueryOpen(false); setUserMenuOpen(v => !v) }} title="Usuario" style={{ width:34, height:34, borderRadius:12 }}>{user?.photoURL ? <img src={user.photoURL} alt="" /> : (user?.displayName ?? user?.email ?? 'U')[0].toUpperCase()}</button>
                {userMenuOpen && <div className="header-popup-menu user-popup-menu"><div className="popup-menu-label">{user?.displayName ?? user?.email}</div><button className="popup-menu-item danger" onClick={signOut}>Cerrar sesión</button></div>}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="app-main" onClick={e => e.stopPropagation()}>
        {tab === 'calendar'  && <CustodyCalendar />}
        {tab === 'requests'  && <RequestsList />}
        {tab === 'notes'     && <NotesPanel />}
        {tab === 'events'    && <EventsPanel />}
        {tab === 'packing'   && <PackingPanel />}
        {tab === 'stats'     && <StatsPanel />}
        {tab === 'settings'  && <><div className="page-title">Configuración</div><SettingsPanel /></>}
      </main>

      {searchOpen && <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:90, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'70px 14px 14px' }} onClick={() => setSearchOpen(false)}><div className="card" style={{ width:'100%', maxWidth:680, maxHeight:'80vh', overflow:'auto', padding:14 }} onClick={e => e.stopPropagation()}><div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}><input autoFocus value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar en eventos, notas, cambios, menores, progenitores..." className="settings-input" style={{ marginBottom:0 }} /><button className="btn-primary btn-outline" style={{ padding:'10px 12px' }} onClick={() => setSearchOpen(false)}>Cerrar</button></div><div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:4, marginBottom:10, flexWrap:'wrap' }}>{[['all','Todo'],['event','Eventos'],['note','Notas'],['request','Cambios'],['special_period','Períodos'],['child','Menores'],['parent','Progenitores']].map(([value, label]) => <button key={value} onClick={() => setSearchFilter(value as any)} style={{ padding:'6px 10px', borderRadius:999, border:`1px solid ${searchFilter === value ? 'var(--text-strong)' : 'var(--border)'}`, background: searchFilter === value ? 'var(--bg-soft)' : 'transparent', color:'var(--text-secondary)', fontSize:11, fontWeight:700, cursor:'pointer' }}>{label}</button>)}</div>{groupedSearchResults.length === 0 ? <div className="popup-empty">No hay resultados para esa búsqueda.</div> : groupedSearchResults.map(([group, items]) => <div key={group} style={{ marginBottom:12 }}><div style={{ fontSize:11, fontWeight:800, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:0.4, marginBottom:6 }}>{group}</div><div style={{ display:'grid', gap:6 }}>{items.map(item => <button key={item.id} className="notification-item" onClick={() => openSearchResult(item)} style={{ textAlign:'left' }}><div className="notification-item-title">{item.title}</div><div className="notification-item-body">{item.subtitle}</div></button>)}</div></div>)}</div></div>}

      {moreOpen && <div className="floating-more-menu" onClick={e => e.stopPropagation()}>{[{ id: 'packing' as Tab, label: '🧳 Equipaje' }, { id: 'stats' as Tab, label: '📊 Estadísticas' }, { id: 'settings' as Tab, label: '⚙️ Ajustes' }].map(({ id, label }) => <button key={id} className={`floating-more-item ${tab===id ? 'active' : ''}`} onClick={() => { setTab(id); setMoreOpen(false) }}>{label}</button>)}</div>}

      <nav className="bottom-nav" onClick={e => e.stopPropagation()}>
        {mainTabs.map(({ id, label, emoji, badge }) => <button key={id} className={`nav-btn ${(tab === id || (id === 'settings' && activeMore)) ? 'active' : ''}`} onClick={() => handleTabClick(id)}><span style={{ fontSize: 20, lineHeight: 1 }}>{emoji}</span><span>{label}</span>{badge && badge > 0 ? <span className="nav-badge">{badge}</span> : null}{(tab === id || (id === 'settings' && activeMore)) && <span className="nav-active-line" />}</button>)}
      </nav>
    </div>
  )
}
