'use client'

import { useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { deleteEvent } from '@/lib/db'
import { showToast } from '@/lib/toast'

export function EventDeleteBridge() {
  const { user } = useAuth()
  const { events } = useAppStore()

  useEffect(() => {
    if (typeof document === 'undefined') return

    const findEvent = (button: HTMLButtonElement) => {
      const text = (button.closest('.card')?.textContent || '').toLowerCase()
      return events.find(event => event.title && text.includes(event.title.toLowerCase())) || null
    }

    const syncButtons = () => {
      document.querySelectorAll<HTMLButtonElement>('button[aria-label="Más acciones"], button[title="Más acciones"]').forEach(button => {
        if (!findEvent(button)) return
        button.dataset.eventDeleteButton = 'true'
        button.textContent = '🗑️'
        button.title = 'Eliminar evento'
        button.setAttribute('aria-label', 'Eliminar evento')
        button.style.background = 'rgba(239,68,68,0.10)'
        button.style.border = '1px solid rgba(239,68,68,0.18)'
        button.style.color = '#fca5a5'
      })
    }

    const capture = async (event: MouseEvent) => {
      const button = (event.target as HTMLElement | null)?.closest('button') as HTMLButtonElement | null
      if (!button?.dataset.eventDeleteButton) return
      const item = findEvent(button)
      if (!item || !user?.uid) return
      event.preventDefault()
      event.stopPropagation()
      if (!window.confirm('¿Eliminar este evento?')) return
      try {
        await deleteEvent(item.id)
        showToast({ message: 'Evento eliminado.', tone: 'success' })
      } catch (error: any) {
        showToast({ message: error?.message || 'No se pudo eliminar el evento.', tone: 'error' })
      }
    }

    syncButtons()
    const observer = new MutationObserver(syncButtons)
    observer.observe(document.body, { childList: true, subtree: true })
    document.addEventListener('click', capture, true)
    return () => {
      observer.disconnect()
      document.removeEventListener('click', capture, true)
    }
  }, [events, user?.uid])

  return null
}
