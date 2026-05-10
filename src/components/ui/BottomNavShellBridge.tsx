'use client'

import { useEffect, useState } from 'react'
import { BottomNavShell } from '@/components/ui/BottomNavShell'

type Tab = 'today' | 'calendar' | 'requests' | 'more'

const TABS = [
  { id: 'today' as Tab, label: 'Hoy', icon: '/nav-icons/calendar.svg' },
  { id: 'calendar' as Tab, label: 'Calendario', icon: '/nav-icons/calendar.svg' },
  { id: 'requests' as Tab, label: 'Cambios', icon: '/nav-icons/changes.svg' },
  { id: 'more' as Tab, label: 'Más', icon: '/nav-icons/more.svg' },
]

function activeFromLegacy(): Tab {
  if (typeof document === 'undefined') return 'today'
  const active = document.querySelector<HTMLButtonElement>('.bottom-nav .nav-btn.active')
  const text = (active?.textContent || '').toLowerCase()
  if (text.includes('calendario')) return 'calendar'
  if (text.includes('cambios')) return 'requests'
  if (text.includes('más') || text.includes('mas')) return 'more'
  return 'today'
}

function clickLegacy(tab: Tab) {
  if (typeof document === 'undefined') return
  const label = tab === 'today' ? 'hoy' : tab === 'calendar' ? 'calendario' : tab === 'requests' ? 'cambios' : 'más'
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.bottom-nav .nav-btn'))
  const match = buttons.find(button => (button.textContent || '').toLowerCase().includes(label))
  match?.click()
}

export function BottomNavShellBridge() {
  const [activeTab, setActiveTab] = useState<Tab>('today')

  useEffect(() => {
    const sync = () => setActiveTab(activeFromLegacy())
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })
    window.addEventListener('custodia:navigate', sync)
    return () => {
      observer.disconnect()
      window.removeEventListener('custodia:navigate', sync)
    }
  }, [])

  const navigate = (tab: Tab) => {
    setActiveTab(tab)
    clickLegacy(tab)
  }

  const create = () => window.dispatchEvent(new CustomEvent('custodia:open-guided-create'))

  return <BottomNavShell tabs={TABS} activeTab={activeTab} isMoreActive={activeTab === 'more'} onNavigate={navigate} onCreate={create} />
}
