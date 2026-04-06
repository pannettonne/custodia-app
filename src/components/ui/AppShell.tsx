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

const CalIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
const MsgIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
const CfgIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>

export function AppShell() {
  const { user, signOut } = useAuth()
  const { children, selectedChildId, setSelectedChildId, requests, invitations, notes } = useAppStore()
  const [tab, setTab] = useState<Tab>('calendar')
  useDataSubscriptions()

  const child = useMemo(() => children.find(c => c.id === selectedChildId) ?? null, [children, selectedChildId])
  const pendingReqs = useMemo(() => requests.filter(r => r.status === 'pending' && r.toParentId === user?.uid).length, [requests, user?.uid])
  const unreadNotes = useMemo(() => notes.filter(n => !n.read && n.createdBy !== user?.uid && n.mentionOther).length, [notes, user?.uid])
  const totalBadge = pendingReqs + invitations.length + unreadNotes

  // Bottom nav tabs (5 main)
  const mainTabs = [
    { id: 'calendar' as Tab, label: 'Calendario', emoji: '📅' },
    { id: 'requests' as Tab, label: 'Cambios', emoji: '🔄', badge: pendingReqs },
    { id: 'notes' as Tab, label: 'Notas', emoji: '📝', badge: unreadNotes },
    { id: 'events' as Tab, label: 'Eventos', emoji: '🎓' },
    { id: 'settings' as Tab, label: 'Más', emoji: '⋯', badge: invitations.length },
  ]

  // "Más" shows a submenu for packing, stats, settings
  const [moreOpen, setMoreOpen] = useState(false)

  const handleTabClick = (id: Tab) => {
    if (id === 'settings') { setMoreOpen(!moreOpen); return }
    setMoreOpen(false)
    setTab(id)
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-left">
          <div className="app-logo">👨‍👩‍👦</div>
          <div>
            <div className="app-title">CustodiaApp</div>
            {child && <div className="app-subtitle">{child.name}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {children.length > 1 && (
            <select value={selectedChildId ?? ''} onChange={e => setSelectedChildId(e.target.value)}
              style={{ background: 'rgba(255,255,255,0.09)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '5px 10px', color: '#fff', fontSize: 12, outline: 'none' }}>
              {children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          {totalBadge > 0 && (
            <button className="notif-btn" onClick={() => { setMoreOpen(false); setTab(unreadNotes > 0 ? 'notes' : pendingReqs > 0 ? 'requests' : 'settings') }}>
              🔔<span className="notif-count">{totalBadge}</span>
            </button>
          )}
          <button className="user-avatar" onClick={signOut} title="Cerrar sesión">
            {user?.photoURL ? <img src={user.photoURL} alt="" /> : (user?.displayName ?? user?.email ?? 'U')[0].toUpperCase()}
          </button>
        </div>
      </header>

      {/* More submenu */}
      {moreOpen && (
        <div style={{ background: '#161b22', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '8px 12px', display: 'flex', gap: 6 }}>
          {[
            { id: 'packing' as Tab, label: '🧳 Equipaje' },
            { id: 'stats' as Tab, label: '📊 Estadísticas' },
            { id: 'settings' as Tab, label: '⚙️ Ajustes' },
          ].map(({ id, label }) => (
            <button key={id} onClick={() => { setTab(id); setMoreOpen(false) }}
              style={{ flex: 1, padding: '8px 4px', borderRadius: 10, border: `1px solid ${tab===id ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)'}`, background: tab===id ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)', color: tab===id ? '#fff' : '#9ca3af', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
              {label}
            </button>
          ))}
        </div>
      )}

      <main className="app-main">
        {tab === 'calendar'  && <><CustodyCalendar /><QuickDateQuery /></>}
        {tab === 'requests'  && <RequestsList />}
        {tab === 'notes'     && <NotesPanel />}
        {tab === 'events'    && <EventsPanel />}
        {tab === 'packing'   && <PackingPanel />}
        {tab === 'stats'     && <StatsPanel />}
        {tab === 'settings'  && <><div className="page-title">Configuración</div><SettingsPanel /></>}
      </main>

      <nav className="bottom-nav">
        {mainTabs.map(({ id, label, emoji, badge }) => (
          <button key={id} className={`nav-btn ${(tab === id || (id === 'settings' && ['packing','stats','settings'].includes(tab))) ? 'active' : ''}`}
            onClick={() => handleTabClick(id)}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>{emoji}</span>
            <span>{label}</span>
            {badge && badge > 0 ? <span className="nav-badge">{badge}</span> : null}
            {(tab === id || (id === 'settings' && ['packing','stats','settings'].includes(tab))) && <span className="nav-active-line" />}
          </button>
        ))}
      </nav>
    </div>
  )
}
