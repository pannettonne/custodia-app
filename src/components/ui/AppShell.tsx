'use client'

import { useState, useMemo } from 'react'
import { Calendar, MessageSquare, Settings, LogOut, Baby, Bell } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { useDataSubscriptions } from '@/hooks/useDataSubscriptions'
import { CustodyCalendar } from '@/components/calendar/CustodyCalendar'
import { QuickDateQuery } from '@/components/calendar/QuickDateQuery'
import { RequestsList } from '@/components/requests/RequestsList'
import { SettingsPanel } from '@/components/settings/SettingsPanel'
import { cn } from '@/lib/utils'

type Tab = 'calendar' | 'requests' | 'settings'

export function AppShell() {
  const { user, signOut } = useAuth()
  const { children, selectedChildId, setSelectedChildId, requests, invitations } = useAppStore()
  const [tab, setTab] = useState<Tab>('calendar')

  // Subscribe to all real-time data
  useDataSubscriptions()

  const child = useMemo(
    () => children.find((c) => c.id === selectedChildId) ?? null,
    [children, selectedChildId]
  )

  const pendingRequests = useMemo(
    () => requests.filter((r) => r.status === 'pending' && r.toParentId === user?.uid).length,
    [requests, user?.uid]
  )

  const totalBadge = pendingRequests + invitations.length

  const tabs = [
    { id: 'calendar' as Tab, label: 'Calendario', icon: Calendar },
    { id: 'requests' as Tab, label: 'Solicitudes', icon: MessageSquare, badge: pendingRequests },
    { id: 'settings' as Tab, label: 'Ajustes', icon: Settings, badge: invitations.length },
  ]

  return (
    <div className="min-h-screen bg-[#0d1117] flex flex-col max-w-lg mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between px-5 pt-safe-top pt-4 pb-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-lg">
            👨‍👩‍👦
          </div>
          <div>
            <h1 className="text-white font-bold text-sm leading-tight">CustodiaApp</h1>
            {child && (
              <p className="text-slate-500 text-xs">{child.name}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Child selector if multiple */}
          {children.length > 1 && (
            <select
              value={selectedChildId ?? ''}
              onChange={(e) => setSelectedChildId(e.target.value)}
              className="bg-white/10 border border-white/20 rounded-xl px-2 py-1 text-white text-xs focus:outline-none"
            >
              {children.map((c) => (
                <option key={c.id} value={c.id} className="bg-slate-900">
                  {c.name}
                </option>
              ))}
            </select>
          )}

          {/* Notification bell */}
          {totalBadge > 0 && (
            <button
              onClick={() => setTab(invitations.length > 0 ? 'settings' : 'requests')}
              className="relative p-2 rounded-xl bg-white/5 border border-white/10"
            >
              <Bell size={16} className="text-yellow-400" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">
                {totalBadge}
              </span>
            </button>
          )}

          {/* Avatar */}
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 p-1.5 rounded-xl hover:bg-white/10 transition-colors group"
            title="Cerrar sesión"
          >
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName ?? 'Usuario'}
                className="w-7 h-7 rounded-full"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold">
                {(user?.displayName ?? user?.email ?? 'U')[0].toUpperCase()}
              </div>
            )}
            <LogOut size={12} className="text-slate-600 group-hover:text-slate-300 transition-colors" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-4 py-4">
        {tab === 'calendar' && (
          <div className="space-y-4">
            <CustodyCalendar />
            <QuickDateQuery />
          </div>
        )}
        {tab === 'requests' && (
          <div>
            <h2 className="text-white font-bold text-lg mb-4">Solicitudes de cambio</h2>
            <RequestsList />
          </div>
        )}
        {tab === 'settings' && (
          <div>
            <h2 className="text-white font-bold text-lg mb-4">Configuración</h2>
            <SettingsPanel />
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="border-t border-white/10 bg-[#0d1117]/95 backdrop-blur-xl px-4 pb-safe-bottom">
        <div className="flex items-center">
          {tabs.map(({ id, label, icon: Icon, badge }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 py-3 transition-all relative',
                tab === id ? 'text-blue-400' : 'text-slate-600 hover:text-slate-400'
              )}
            >
              <div className="relative">
                <Icon size={22} strokeWidth={tab === id ? 2.5 : 1.5} />
                {badge && badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">
                    {badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-semibold">{label}</span>
              {tab === id && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-blue-400 rounded-full" />
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
