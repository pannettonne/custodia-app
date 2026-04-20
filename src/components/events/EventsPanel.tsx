'use client'
import { EventsPanel as EventsPanelImpl } from './EventsPanelWithLocation'

type EventsPanelProps = {
  focusTargetId?: string
  focusSeq?: number
  initialCreateDate?: string
  createSeq?: number
}

const EventsPanelComponent = EventsPanelImpl as any

export function EventsPanel(props: EventsPanelProps) {
  return <EventsPanelComponent {...props} />
}
