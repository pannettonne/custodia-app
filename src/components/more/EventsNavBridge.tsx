'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'

function getBottomNavButtons() {
  if (typeof document === 'undefined') return [] as HTMLButtonElement[]
  return Array.from(document.querySelectorAll<HTMLButtonElement>('.bottom-nav button'))
}

function isNotesBottomButton(button: HTMLButtonElement) {
  const text = (button.textContent || '').trim().toLowerCase()
  return text === 'notas' || !!button.querySelector('img[src*="/nav-icons/notes.svg"]')
}

function findMoreGrid() {
  if (typeof document === 'undefined') return null
  return document.querySelector<HTMLElement>('.more-real-grid')
}

function syncMoreCards() {
  const grid = findMoreGrid()
  if (!grid) return null

  for (const card of Array.from(grid.querySelectorAll<HTMLElement>('.more-real-card'))) {
    const title = (card.querySelector('.more-real-card-title')?.textContent || '').trim().toLowerCase()
    if (title === 'eventos') card.style.display = 'none'
  }

  return grid
}

function injectHeroCleanupStyles() {
  if (typeof document === 'undefined' || document.getElementById('custodia-hero-cleanup')) return
  const style = document.createElement('style')
  style.id = 'custodia-hero-cleanup'
  style.textContent = `
    .app-main .card > div:first-child:has(.page-title) {
      padding: 0 !important;
      margin: 0 !important;
      border: 0 !important;
      border-radius: 0 !important;
      background: transparent !important;
      box-shadow: none !important;
      outline: 0 !important;
      overflow: visible !important;
    }
    .app-main .card > div:first-child:has(.page-title)::after {
      display: none !important;
      content: none !important;
    }
    .app-main .card > div:first-child:has(.page-title) .page-title {
      padding: 0 !important;
      border: 0 !important;
      border-radius: 0 !important;
      background: transparent !important;
      box-shadow: none !important;
    }
    .app-main:has(.req-action-btn) .card > div:first-child:has(.page-title) .page-title::before {
      display: none !important;
      content: none !important;
    }
    .app-main:has(input[placeholder='Nombre del medicamento']) .card > div:first-child:has(.page-title) .page-title::before {
      content: 'SALUD' !important;
      display: block !important;
      margin-bottom: 8px !important;
      color: #ec4899 !important;
      font-size: 10px !important;
      font-weight: 950 !important;
      letter-spacing: 0.62px !important;
      text-transform: uppercase !important;
    }
  `
  document.head.appendChild(style)
}

export function EventsNavBridge() {
  const [moreGrid, setMoreGrid] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return

    injectHeroCleanupStyles()

    const syncNavigation = () => {
      injectHeroCleanupStyles()
      for (const button of getBottomNavButtons()) {
        if (!isNotesBottomButton(button)) continue
        button.setAttribute('data-custodia-events-tab', 'true')
        const img = button.querySelector<HTMLImageElement>('img')
        if (img && !img.src.includes('/nav-icons/events.svg')) img.src = '/nav-icons/events.svg'
        for (const node of Array.from(button.childNodes)) {
          if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) node.textContent = 'Eventos'
        }
        const labels = Array.from(button.querySelectorAll<HTMLElement>('span, div'))
        for (const label of labels) {
          if ((label.textContent || '').trim().toLowerCase() === 'notas') label.textContent = 'Eventos'
        }
      }
      setMoreGrid(syncMoreCards())
    }

    syncNavigation()
    const observer = new MutationObserver(syncNavigation)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'class', 'style'] })

    const handleClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const button = target.closest<HTMLButtonElement>('button[data-custodia-events-tab="true"]')
      if (!button) return
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      window.dispatchEvent(new CustomEvent('custodia:navigate', { detail: { tab: 'events' } }))
    }

    window.addEventListener('click', handleClick, { capture: true })
    return () => {
      observer.disconnect()
      window.removeEventListener('click', handleClick, { capture: true } as any)
    }
  }, [])

  const notesCard = moreGrid
    ? createPortal(
        <button
          type="button"
          className="more-real-card more-notes-card"
          style={{ '--more-tone': '#3B82F6' } as CSSProperties}
          onClick={() => window.dispatchEvent(new CustomEvent('custodia:navigate', { detail: { tab: 'notes' } }))}
        >
          <span className="more-real-card-copy">
            <span className="more-real-card-title">Notas</span>
            <span className="more-real-card-subtitle">Avisos y observaciones</span>
          </span>
          <span className="more-real-icon-wrap">
            <img src="/nav-icons/notes.svg" alt="" aria-hidden="true" />
          </span>
        </button>,
        moreGrid
      )
    : null

  return <>{notesCard}</>
}
