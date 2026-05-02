'use client'

import { useEffect, useState } from 'react'
import { EventForm } from '@/components/events/location/EventForm'

type InlineEvent = { date: string; seq: number } | null

export function CalendarInlineComposerBridge() {
  const [inlineEvent, setInlineEvent] = useState<InlineEvent>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<any>).detail
      if (detail?.openComposer !== 'event' || !detail?.date) return
      event.preventDefault()
      setInlineEvent({ date: detail.date, seq: Date.now() })
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('custodia:navigate', { detail: { tab: 'calendar', childId: detail.childId, date: detail.date } }))
      }, 0)
    }
    window.addEventListener('custodia:navigate', handler, { capture: true })
    return () => window.removeEventListener('custodia:navigate', handler, { capture: true } as any)
  }, [])

  if (!inlineEvent) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(0,0,0,0.52)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '74px 14px 18px' }} onClick={() => setInlineEvent(null)}>
      <div style={{ width: '100%', maxWidth: 560, maxHeight: 'calc(100dvh - 92px)', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
        <EventForm key={inlineEvent.seq} event={null} initialDate={inlineEvent.date} onClose={() => setInlineEvent(null)} />
      </div>
    </div>
  )
}
