'use client'
import { EventsPanel as EventsPanelImpl } from './EventsPanelWithLocation'

type EventsPanelProps = {
  focusTargetId?: string
  focusSeq?: number
  initialCreateDate?: string
  createSeq?: number
}

export function EventsPanel(props: EventsPanelProps) {
  return <EventsPanelImpl {...props} />
}
