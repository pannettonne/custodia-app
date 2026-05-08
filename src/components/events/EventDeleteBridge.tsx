'use client'

import { useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { createNotification, deleteEvent, updateEvent } from '@/lib/db'
import { showToast } from '@/lib/toast'

export function EventDeleteBridge() {
  const { user } = useAuth()
  const { events, children } = useAppStore()

  useEffect(() => {
    if (typeof document === 'undefined') return

    const findEvent = (button: HTMLButtonElement) => {
      const text = (button.closest('.card')?.textContent || '').toLowerCase()
      return events.find(event => event.title && text.includes(event.title.toLowerCase())) || null
    }

    const syncButtons = () => {
      document.querySelectorAll<HTMLButtonElement>('button[aria-label="Más acciones"], button[title="Más acciones"]').forEach(button => {
        const item = findEvent(button)
        if (!item) return
        button.dataset.eventDeleteButton = 'true'
        button.textContent = '🗑️'
        button.title = 'Eliminar evento'
        button.setAttribute('aria-label', 'Eliminar evento')
        button.style.background = 'rgba(239,68,68,0.10)'
        button.style.border = '1px solid rgba(239,68,68,0.18)'
        button.style.color = '#fca5a5'
        const row = button.parentElement?.parentElement || button.parentElement
        if (row instanceof HTMLElement) {
          row.style.justifyContent = 'flex-end'
          row.style.width = '100%'
          row.style.paddingRight = '2px'
        }
      })
    }

    const capture = async (event: MouseEvent) => {
      const button = (event.target as HTMLElement | null)?.closest('button') as HTMLButtonElement | null
      if (!button?.dataset.eventDeleteButton) return
      const item = findEvent(button)
      if (!item || !user?.uid) return
      event.preventDefault()
      event.stopPropagation()

      const child = children.find(c => c.id === item.childId)
      const otherParentId = child?.parents?.find((id: string) => id !== user.uid)
      const needsRequest = item.assignmentStatus === 'accepted' && !!item.assignedParentId && !!otherParentId
      const ok = window.confirm(needsRequest ? '¿Solicitar eliminación de este evento?' : '¿Eliminar este evento?')
      if (!ok) return

      try {
        if (needsRequest && child && otherParentId) {
          const requesterName = user.displayName || user.email || 'Progenitor'
          await updateEvent(item.id, {
            deletionRequestStatus: 'pending',
            deletionRequestedBy: user.uid,
            deletionRequestedByName: requesterName,
            deletionRequestToParentId: otherParentId,
          })
          await createNotification({
            userId: otherParentId,
            childId: item.childId,
            childName: child.name,
            type: 'event_assignment_pending',
            title: 'Eliminación de evento pendiente',
            body: `${requesterName} quiere eliminar el evento ${item.title}.`,
            dateKey: item.date,
            targetTab: 'events',
            targetDate: item.date,
          })
          showToast({ message: 'Solicitud de eliminación enviada.', tone: 'success' })
          return
        }
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
  }, [events, children, user?.uid])

  return null
}
