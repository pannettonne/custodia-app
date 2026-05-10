'use client'

import type { ReactNode } from 'react'
import styles from './BottomNavShell.module.css'

type BottomNavTab<T extends string> = {
  id: T
  label: string
  icon: string
  badge?: number
}

type BottomNavShellProps<T extends string> = {
  tabs: BottomNavTab<T>[]
  activeTab: T
  isMoreActive: boolean
  onNavigate: (tab: T) => void
  onCreate: () => void
}

function Badge({ value }: { value?: number }) {
  if (!value || value <= 0) return null
  return <span className="nav-badge">{value > 99 ? '99+' : value}</span>
}

function NavButton<T extends string>({ item, active, onNavigate }: { item: BottomNavTab<T>; active: boolean; onNavigate: (tab: T) => void }) {
  return (
    <button type="button" className={`nav-btn ${active ? 'active' : ''}`} onClick={() => onNavigate(item.id)}>
      <img src={item.icon} alt="" aria-hidden="true" />
      <span>{item.label}</span>
      <Badge value={item.badge} />
      {active ? <span className="nav-active-line" /> : null}
    </button>
  )
}

function Slot({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return <div className={`bottom-nav-slot ${className}`}>{children}</div>
}

export function BottomNavShell<T extends string>({ tabs, activeTab, isMoreActive, onNavigate, onCreate }: BottomNavShellProps<T>) {
  const visibleTabs = tabs.filter(tab => tab.label !== 'Eventos')
  const leftTabs = visibleTabs.slice(0, 2)
  const rightTabs = visibleTabs.slice(2, 4)

  return (
    <div className={styles.moduleRoot}>
      <nav className="bottom-nav-shell" onClick={event => event.stopPropagation()} aria-label="Navegación principal">
        <img className="bottom-nav-shell-bg" src="/nav-shells/bottom-nav-shell.svg" alt="" aria-hidden="true" />
        <div className="bottom-nav-shell-grid">
          <Slot className="slot-left-a">
            {leftTabs[0] ? <NavButton item={leftTabs[0]} active={activeTab === leftTabs[0].id} onNavigate={onNavigate} /> : null}
          </Slot>
          <Slot className="slot-left-b">
            {leftTabs[1] ? <NavButton item={leftTabs[1]} active={activeTab === leftTabs[1].id} onNavigate={onNavigate} /> : null}
          </Slot>
          <Slot className="slot-create">
            <button type="button" className="nav-create-btn" aria-label="Crear" title="Crear" onClick={onCreate}>
              <span className="nav-create-orb" aria-hidden="true">+</span>
            </button>
          </Slot>
          <Slot className="slot-right-a">
            {rightTabs[0] ? <NavButton item={rightTabs[0]} active={activeTab === rightTabs[0].id} onNavigate={onNavigate} /> : null}
          </Slot>
          <Slot className="slot-right-b">
            {rightTabs[1] ? <NavButton item={rightTabs[1]} active={isMoreActive || activeTab === rightTabs[1].id} onNavigate={onNavigate} /> : null}
          </Slot>
        </div>
      </nav>
    </div>
  )
}
