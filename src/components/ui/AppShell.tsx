'use client'
import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { useDataSubscriptions } from '@/hooks/useDataSubscriptions'
import { CustodyCalendar } from '@/components/calendar/CustodyCalendar'
import { QuickDateQuery } from '@/components/calendar/QuickDateQuery'
import { RequestsList } from '@/components/requests/RequestsList'
import { SettingsPanel } from '@/components/settings/SettingsPanel'
import { NotesPanel } from '@/components/notes/NotesPanel'
import { EventsPanel } from '@/components/events/EventsPanel'
import { PackingPanel } from '@/components/packing/PackingPanel'
import { StatsPanel } from '@/components/stats/StatsPanel'
import { GlobalToasts } from '@/components/ui/GlobalToasts'
import { markNotificationRead } from '@/lib/db'
import type { AppNotification } from '@/types'

type Tab = 'calendar' | 'requests' | 'notes' | 'events' | 'packing' | 'stats' | 'settings'
type SearchResultType = 'child' | 'parent' | 'event' | 'note' | 'request' | 'special_period'
type SearchResult = { id: string; type: SearchResultType; title: string; subtitle: string; childId?: string; date?: string; endDate?: string; targetTab: Tab }
type FocusTarget = { id: string; seq: number } | null
type DraftTarget = { date: string; seq: number } | null

type CalendarNavigateDetail = {
  tab: 'notes' | 'events' | 'requests'
  childId?: string
  date?: string
  focusTargetId?: string
  openComposer?: 'note' | 'event'
}

function inferTargetTab(item: AppNotification): Tab {
  if (item.targetTab) return item.targetTab
  if (item.type === 'pending_request' || item.type === 'event_assignment_pending' || item.type === 'event_assignment_response') return 'requests'
  if (item.type === 'event_reminder') return 'events'
  return 'calendar'
}
function notificationGroupLabel(type: AppNotification['type']) { if (type === 'pending_request') return 'Cambios'; if (type === 'event_assignment_pending' || type === 'event_assignment_response') return 'Asignaciones'; if (type === 'event_reminder') return 'Recordatorios'; return 'Otros' }
function normalizeText(value: string) { return (value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() }
function matchesQuery(query: string, ...fields: Array<string | undefined | null>) { const q = normalizeText(query); if (!q) return true; return fields.some(field => normalizeText(field || '').includes(q)) }
function searchGroupLabel(type: SearchResultType) { if (type === 'event') return 'Eventos'; if (type === 'note') return 'Notas'; if (type === 'request') return 'Cambios'; if (type === 'special_period') return 'Períodos especiales'; if (type === 'child') return 'Menores'; return 'Progenitores' }

const HEADER_SEARCH_ICON = "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiA/Pjxzdmcgdmlld0JveD0iMCAwIDMyIDMyIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxkZWZzPjxzdHlsZT4uY2xzLTF7ZmlsbDpub25lO308L3N0eWxlPjwvZGVmcz48dGl0bGUvPjxnIGRhdGEtbmFtZT0iTGF5ZXIgMiIgaWQ9IkxheWVyXzIiPjxwYXRoIGQ9Ik00MSxyM0ExMCwxMCwwLDEsMSwyMywxMyxxMCwxMCwwLDAsMSwxMywyM1JnTktNTDsNWE8xLDApODUsMCgxLDAsOCw4QTgsOC4wLDAsMC8xMyw1WiIvPjxwYXRoIGQ9Ik0yOCwyOWExLDEsMC0wLDEtLjCxLS4yOWwtNC04YTEsMSwwLDAsMSx1Ni0xLjQyLTEu^