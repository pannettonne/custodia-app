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

function inferTargetTab(item: AppNotification): Tab {
  if (item.targetTab) return item.targetTab
  if (item.type === 'pending_request' || item.type === 'event_assignment_pending' || item.type === 'event_assignment_response') return 'requests'
  if (item.type === 'event_reminder') return 'events'
  return 'calendar'
}

function notificationGroupLabel(type: AppNotification['type']) {
  if (type === 'pending_request') return 'Cambios'
  if (type === 'event_assignment_pending' || type === 'event_assignment_response') return 'Asignaciones'
  if (type === 'event_reminder') return 'Recordatorios'
  return 'Otros'
}

export function AppShell() {
  const { user, signOut } = useAuth()
  const { children, selectedChildId, setSelectedChildId, requests, invitations, notes, notifications, setCurrentMonth, setSelectedCalendarDate } = useAppStore()
  const [tab, setTab] = useState<Tab>('calendar')
  const [moreOpen, setMoreOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [queryOpen, setQueryOpen] = useState(false)
  const [notifFilter, setNotifFilter] = useState<'unread' | 'all'>('unread')
  useDataSubscriptions()

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
    if (targetTab) setTab(targetTab)
  }, [])

  const child = useMemo(() => children.find(c => c.id === selectedChildId) ?? null, [children, selectedChildId])
  const pendingReqs = useMemo(() => requests.filter(r => r.status === 'pending' && r.toParentId === user?.uid).length, [requests, user?.uid])
  const unreadNotes = useMemo(() => notes.filter(n => !n.read && n.createdBy !== user?.uid && n.mentionOther).length, [notes, user?.uid])
  const pendingInvitations = useMemo(() => {
    const myEmail = (user?.email ?? '').trim().toLowerCase()
    return invitations.filter(i => i.status === 'pending' && i.toEmail === myEmail).length
  }, [invitations, user?.email])
  const unreadNotifications = useMemo(() => notifications.filter(n => !n.read).length, [notifications])
  const totalBadge = pendingReqs + pendingInvitations + unreadNotes + unreadNotifications

  const visibleNotifications = useMemo(() => notifFilter === 'unread' ? notifications.filter(n => !n.read) : notifications, [notifications, notifFilter])
  const groupedNotifications = useMemo(() => {
    const groups: Record<string, AppNotification[]> = {}
    for (const item of visibleNotifications) {
      const key = notificationGroupLabel(item.type)
      groups[key] ||= []
      groups[key].push(item)
    }
    return Object.entries(groups)
  }, [visibleNotifications])

  const mainTabs = [
    { id: 'calendar' as Tab, label: 'Calendario', emoji: '📅' },
    { id: 'requests' as Tab, label: 'Cambios', emoji: '🔄', badge: pendingReqs },
    { id: 'notes' as Tab, label: 'Notas', emoji: '📝', badge: unreadNotes },
    { id: 'events' as Tab, label: 'Eventos', emoji: '🎓' },
    { id: 'settings' as Tab, label: 'Más', emoji: '⋯', badge: pendingInvitations },
  ]

  const openNotification = async (item: AppNotification) => {
    await markNotificationRead(item.id)
    if (item.childId) setSelectedChildId(item.childId)
    if (item.targetDate) {
      setSelectedCalendarDate(item.targetDate)
      setCurrentMonth(new Date(item.targetDate + 'T12:00:00'))
    }
    setTab(inferTargetTab(item))
    setNotifOpen(false)
  }

  const markAllVisibleAsRead = async () => {
    const unread = visibleNotifications.filter(n => !n.read)
    await Promise.all(unread.map(n => markNotificationRead(n.id)))
  }

  const handleTabClick = (id: Tab) => {
    setUserMenuOpen(false)
    setNotifOpen(false)
    setQueryOpen(false)
    if (id === 'settings') {
      setMoreOpen(v => !v)
      return
    }
    setMoreOpen(false)
    setTab(id)
  }

  const activeMore = ['packing', 'stats', 'settings'].includes(tab)

  return (
    <div className="app-shell" onClick={() => { if (moreOpen) setMoreOpen(false); if (userMenuOpen) setUserMenuOpen(false); if (notifOpen) setNotifOpen(false); if (queryOpen) setQueryOpen(false) }}>
      <header className="app-header" onClick={e => e.stopPropagation()}>
        <div className="app-header-left">
          <div className="app-logo">👨‍👩‍👦</div>
          <div>
            <div className="app-title">CustodiaApp</div>
            <div style={{ display:'flex', alignItems:'center', gap:8, position:'relative' }}>
              {child && <div className="app-subtitle">{child.name}</div>}
              <div style={{ position:'relative' }}>
                <button onClick={() => { setMoreOpen(false); setUserMenuOpen(false); setNotifOpen(false); setQueryOpen(v => !v) }} title="Consulta rápida" style={{ width:20, height:20, borderRadius:'50%', border:'1px solid var(--border-hover)', background:'var(--bg-soft)', color:'var(--text-secondary)', fontSize:12, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>?</button>
                {queryOpen && (
                  <div className="header-popup-menu" style={{ left:0, right:'auto', minWidth:300, padding:0, overflow:'hidden' }}>
                    <QuickDateQuery />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
          {children.length > 1 && (
            <select value={selectedChildId ?? ''} onChange={e => setSelectedChildId(e.target.value)} style={{ background: 'var(--bg-input)', border: '1px solid var(--border-hover)', borderRadius: 12, padding: '7px 12px', color: 'var(--text-strong)', fontSize: 12, outline: 'none', boxShadow: 'var(--card-shadow)' }}>
              {children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <div style={{ position: 'relative' }}>
            <button className="notif-btn" onClick={() => { setMoreOpen(false); setUserMenuOpen(false); setQueryOpen(false); setNotifOpen(v => !v) }}>
              🔔{totalBadge > 0 ? <span className="notif-count">{totalBadge}</span> : null}
            </button>
            {notifOpen && (
              <div className="header-popup-menu notifications-popup-menu" style={{ width: 340, maxHeight: '70vh', overflow: 'auto' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, marginBottom:8 }}>
                  <div className="popup-menu-label" style={{ margin:0 }}>Avisos</div>
                  <button className="popup-menu-item" style={{ padding:'4px 8px' }} onClick={markAllVisibleAsRead}>Marcar todo leído</button>
                </div>
                <div style={{ display:'flex', gap:6, marginBottom:10 }}>
                  <button className="popup-menu-item" style={{ flex:1, justifyContent:'center', background: notifFilter === 'unread' ? 'var(--bg-soft)' : 'transparent' }} onClick={() => setNotifFilter('unread')}>No leídos</button>
                  <button className="popup-menu-item" style={{ flex:1, justifyContent:'center', background: notifFilter === 'all' ? 'var(--bg-soft)' : 'transparent' }} onClick={() => setNotifFilter('all')}>Todos</button>
                </div>
                {groupedNotifications.length === 0 ? (
                  <div className="popup-empty">No hay avisos en esta vista.</div>
                ) : (
                  groupedNotifications.map(([group, items]) => (
                    <div key={group} style={{ marginBottom:10 }}>
                      <div style={{ fontSize:11, fontWeight:800, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:0.4, marginBottom:6 }}>{group}</div>
                      {items.map(item => (
                        <button key={item.id} className="notification-item" onClick={() => openNotification(item)}>
                          <div className="notification-item-title">{item.title}</div>
                          <div className="notification-item-body">{item.body}</div>
                          {!item.read && <div className="notification-item-dot" />}
                        </button>
                      ))}
                    </div>
                  ))
                )}
                {(pendingReqs > 0 || unreadNotes > 0 || pendingInvitations > 0) && <div style={{ borderTop:'1px solid var(--border)', marginTop:8, paddingTop:8, display:'flex', flexDirection:'column', gap:4 }}>
                  {pendingReqs > 0 && <button className="popup-menu-item" onClick={() => { setTab('requests'); setNotifOpen(false) }}>Ver solicitudes pendientes</button>}
                  {unreadNotes > 0 && <button className="popup-menu-item" onClick={() => { setTab('notes'); setNotifOpen(false) }}>Ver notas no leídas</button>}
                  {pendingInvitations > 0 && <button className="popup-menu-item" onClick={() => { setTab('settings'); setNotifOpen(false) }}>Ver invitaciones pendientes</button>}
                </div>}
              </div>
            )}
          </div>
          <div style={{ position: 'relative' }}>
            <button className="user-avatar" onClick={() => { setMoreOpen(false); setNotifOpen(false); setQueryOpen(false); setUserMenuOpen(v => !v) }} title="Usuario">
              {user?.photoURL ? <img src={user.photoURL} alt="" /> : (user?.displayName ?? user?.email ?? 'U')[0].toUpperCase()}
            </button>
            {userMenuOpen && (
              <div className="header-popup-menu user-popup-menu">
                <div className="popup-menu-label">{user?.displayName ?? user?.email}</div>
                <button className="popup-menu-item danger" onClick={signOut}>Cerrar sesión</button>
              </div>
            )}
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

      {moreOpen && (
        <div className="floating-more-menu" onClick={e => e.stopPropagation()}>
          {[
            { id: 'packing' as Tab, label: '🧳 Equipaje' },
            { id: 'stats' as Tab, label: '📊 Estadísticas' },
            { id: 'settings' as Tab, label: '⚙️ Ajustes' },
          ].map(({ id, label }) => (
            <button key={id} className={`floating-more-item ${tab===id ? 'active' : ''}`} onClick={() => { setTab(id); setMoreOpen(false) }}>
              {label}
            </button>
          ))}
        </div>
      )}

      <nav className="bottom-nav" onClick={e => e.stopPropagation()}>
        {mainTabs.map(({ id, label, emoji, badge }) => (
          <button key={id} className={`nav-btn ${(tab === id || (id === 'settings' && activeMore)) ? 'active' : ''}`} onClick={() => handleTabClick(id)}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>{emoji}</span>
            <span>{label}</span>
            {badge && badge > 0 ? <span className="nav-badge">{badge}</span> : null}
            {(tab === id || (id === 'settings' && activeMore)) && <span className="nav-active-line" />}
          </button>
        ))}
      </nav>
    </div>
  )
}
