'use client'
import { useState, useMemo } from 'react'
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

type Tab = 'calendar' | 'requests' | 'notes' | 'events' | 'packing' | 'stats' | 'settings'

export function AppShell() {
  const { user, signOut } = useAuth()
  const { children, selectedChildId, setSelectedChildId, requests, invitations, notes } = useAppStore()
  const [tab, setTab] = useState<Tab>('calendar')
  const [moreOpen, setMoreOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  useDataSubscriptions()

  const child = useMemo(() => children.find(c => c.id === selectedChildId) ?? null, [children, selectedChildId])
  const pendingReqs = useMemo(() => requests.filter(r => r.status === 'pending' && r.toParentId === user?.uid).length, [requests, user?.uid])
  const unreadNotes = useMemo(() => notes.filter(n => !n.read && n.createdBy !== user?.uid && n.mentionOther).length, [notes, user?.uid])
  const pendingInvitations = useMemo(() => {
    const myEmail = (user?.email ?? '').trim().toLowerCase()
    return invitations.filter(i => i.status === 'pending' && i.toEmail === myEmail).length
  }, [invitations, user?.email])
  const totalBadge = pendingReqs + pendingInvitations + unreadNotes

  const mainTabs = [
    { id: 'calendar' as Tab, label: 'Calendario', emoji: '📅' },
    { id: 'requests' as Tab, label: 'Cambios', emoji: '🔄', badge: pendingReqs },
    { id: 'notes' as Tab, label: 'Notas', emoji: '📝', badge: unreadNotes },
    { id: 'events' as Tab, label: 'Eventos', emoji: '🎓' },
    { id: 'settings' as Tab, label: 'Más', emoji: '⋯', badge: pendingInvitations },
  ]

  const handleTabClick = (id: Tab) => {
    setUserMenuOpen(false)
    if (id === 'settings') {
      setMoreOpen(v => !v)
      return
    }
    setMoreOpen(false)
    setTab(id)
  }

  const handleBellClick = () => {
    setMoreOpen(false)
    setUserMenuOpen(false)
    if (unreadNotes > 0) {
      setTab('notes')
      return
    }
    if (pendingReqs > 0) {
      setTab('requests')
      return
    }
    if (pendingInvitations > 0) {
      setTab('settings')
    }
  }

  const activeMore = ['packing', 'stats', 'settings'].includes(tab)

  return (
    <div className="app-shell" onClick={() => { if (moreOpen) setMoreOpen(false); if (userMenuOpen) setUserMenuOpen(false) }}>
      <header className="app-header" onClick={e => e.stopPropagation()}>
        <div className="app-header-left">
          <div className="app-logo">👨‍👩‍👦</div>
          <div>
            <div className="app-title">CustodiaApp</div>
            {child && <div className="app-subtitle">{child.name}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
          {children.length > 1 && (
            <select value={selectedChildId ?? ''} onChange={e => setSelectedChildId(e.target.value)}
              style={{ background: 'rgba(255,255,255,0.09)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '5px 10px', color: '#fff', fontSize: 12, outline: 'none' }}>
              {children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          {totalBadge > 0 && (
            <button className="notif-btn" onClick={handleBellClick}>
              🔔<span className="notif-count">{totalBadge}</span>
            </button>
          )}
          <div style={{ position: 'relative' }}>
            <button className="user-avatar" onClick={() => { setMoreOpen(false); setUserMenuOpen(v => !v) }} title="Usuario">
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
        {tab === 'calendar'  && <><CustodyCalendar /><QuickDateQuery /></>}
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
          <button key={id} className={`nav-btn ${(tab === id || (id === 'settings' && activeMore)) ? 'active' : ''}`}
            onClick={() => handleTabClick(id)}>
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
