'use client'

import { useEffect } from 'react'

function isMoreButton(target: EventTarget | null) {
  if (!(target instanceof Element)) return false
  const button = target.closest('button')
  if (!button) return false
  const text = (button.textContent || '').trim().toLowerCase()
  return text === 'más' || !!button.querySelector('img[src*="/nav-icons/more.svg"]')
}

function isBottomNavButton(target: EventTarget | null) {
  if (!(target instanceof Element)) return false
  return !!target.closest('.bottom-nav button')
}

export function MoreTabBehaviorGuard() {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return

    const closeMore = () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    }

    const handleClick = (event: MouseEvent) => {
      const moreIsOpen = document.body.classList.contains('custodia-more-open')
      if (!moreIsOpen) return

      if (isMoreButton(event.target)) {
        event.preventDefault()
        event.stopPropagation()
        return
      }

      if (isBottomNavButton(event.target)) closeMore()
    }

    window.addEventListener('click', handleClick, { capture: true })
    return () => window.removeEventListener('click', handleClick, { capture: true } as any)
  }, [])

  return null
}
