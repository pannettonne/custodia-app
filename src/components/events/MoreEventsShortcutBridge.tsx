'use client'

import { useEffect } from 'react'

function createEventsCard() {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'more-real-card more-events-shortcut-card'
  button.setAttribute('data-more-events-shortcut', 'true')
  button.setAttribute('aria-label', 'Abrir eventos')
  button.style.setProperty('--more-tone', '#3B82F6')
  button.innerHTML = `
    <span class="more-real-card-copy">
      <span class="more-real-card-title">Eventos</span>
      <span class="more-real-card-subtitle">Agenda escolar y actividades</span>
    </span>
    <span class="more-real-icon-wrap"><img src="/nav-icons/events.svg" alt="" aria-hidden="true" /></span>
  `
  button.addEventListener('click', event => {
    event.preventDefault()
    event.stopPropagation()
    window.dispatchEvent(new CustomEvent('custodia:navigate', { detail: { tab: 'events' } }))
  })
  return button
}

export function MoreEventsShortcutBridge() {
  useEffect(() => {
    if (typeof document === 'undefined') return

    const sync = () => {
      const grid = document.querySelector<HTMLElement>('.more-real-grid')
      if (!grid) return
      if (grid.querySelector('[data-more-events-shortcut="true"]')) return
      if (Array.from(grid.querySelectorAll('button')).some(button => button.textContent?.includes('Eventos'))) return

      const eventsCard = createEventsCard()
      const cards = Array.from(grid.children)
      const documentsCard = cards.find(card => card.textContent?.includes('Documentos'))
      if (documentsCard) grid.insertBefore(eventsCard, documentsCard)
      else grid.appendChild(eventsCard)
    }

    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return null
}
