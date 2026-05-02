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
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'var(--bg-primary)',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        padding: 'calc(env(safe-area-inset-top) + 18px) 14px calc(env(safe-area-inset-bottom) + 112px)',
      }}
      onClick={() => setInlineComposer(null)}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 560,
          margin: '0 auto',
          minHeight: 'calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 130px)',
          display: 'flex',
          alignItems: 'flex-start',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ width: '100%' }}>
          {inlineComposer.type === 'event'
            ? <EventForm key={inlineComposer.seq} event={null} initialDate={inlineComposer.date} onClose={() => setInlineComposer(null)} />
            : <CalendarInlineNoteForm key={inlineComposer.seq} date={inlineComposer.date} onClose={() => setInlineComposer(null)} />}
        </div>
      </div>
    </div>
  )
}
