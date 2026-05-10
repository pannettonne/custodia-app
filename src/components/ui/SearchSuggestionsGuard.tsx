'use client'

import { useEffect } from 'react'

function localDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function SearchSuggestionsGuard() {
  useEffect(() => {
    if (typeof document === 'undefined') return
    const today = localDateKey()

    const hidePastSuggestions = () => {
      const dialog = document.querySelector<HTMLElement>('[aria-label="Buscar"]')
      if (!dialog) return
      const input = dialog.querySelector<HTMLInputElement>('input')
      if ((input?.value || '').trim()) return
      const title = Array.from(dialog.querySelectorAll<HTMLElement>('div')).find(el => el.textContent?.trim().toLowerCase() === 'sugerencias')
      const list = title?.parentElement?.querySelector<HTMLElement>('div[style*="display: grid"]')
      if (!list) return
      Array.from(list.querySelectorAll<HTMLButtonElement>('button')).forEach(button => {
        const date = button.textContent?.match(/\d{4}-\d{2}-\d{2}/)?.[0]
        if (date && date < today) button.style.display = 'none'
      })
    }

    hidePastSuggestions()
    const timer = window.setInterval(hidePastSuggestions, 250)
    return () => window.clearInterval(timer)
  }, [])

  return null
}
