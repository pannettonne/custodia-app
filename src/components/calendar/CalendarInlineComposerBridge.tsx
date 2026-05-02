'use client'

import { useEffect, useState } from 'react'
import { EventForm } from '@/components/events/location/EventForm'
import { CalendarInlineNoteForm } from '@/components/calendar/CalendarInlineNoteForm'

type InlineComposer = { type: 'event' | 'note'; date: string; seq: number } | null

export function CalendarInlineComposerBridge() {
  const [inlineComposer, setInlineComposer] = useState<InlineComposer>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<any>).detail
      if ((detail?.openComposer !== 'event' && detail?.openComposer !== 'note') || !detail?.date) return
      event.preventDefault()
      setInlineComposer({ type: detail.openComposer, date: detail.date, seq: Date.now() })
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('custodia:navigate', { detail: { tab: 'calendar', childId: detail.childId, date: detail.date } }))
      }, 0)
    }
    window.addEventListener('custodia:navigate', handler, { capture: true })
    return () => window.removeEventListener('custodia:navigate', handler, { capture: true } as any)
  }, [])

  if (!inlineComposer) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(0,0,0,0.52)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '74px 14px 18px' }} onClick={() => setInlineComposer(null)}>
      <div style={{ width: '100%', maxWidth: 560, maxHeight: 'calc(100dvh - 92px)', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
        {inlineComposer.type === 'event'
          ? <EventForm key={inlineComposer.seq} event={null} initialDate={inlineComposer.date} onClose={() => setInlineComposer(null)} />
          : <CalendarInlineNoteForm key={inlineComposer.seq} date={inlineComposer.date} onClose={() => setInlineComposer(null)} />}
      </div>
    </div>
  )
}
