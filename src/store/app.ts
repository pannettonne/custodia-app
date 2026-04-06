import { create } from 'zustand'
import type { Child, CustodyPattern, CustodyOverride, ChangeRequest, Invitation, Note, SchoolEvent, PackingItem } from '@/types'

interface AppState {
  selectedChildId: string | null
  setSelectedChildId: (id: string | null) => void
  children: Child[]
  setChildren: (children: Child[]) => void
  pattern: CustodyPattern | null
  setPattern: (p: CustodyPattern | null) => void
  overrides: CustodyOverride[]
  setOverrides: (o: CustodyOverride[]) => void
  requests: ChangeRequest[]
  setRequests: (r: ChangeRequest[]) => void
  invitations: Invitation[]
  setInvitations: (i: Invitation[]) => void
  notes: Note[]
  setNotes: (n: Note[]) => void
  events: SchoolEvent[]
  setEvents: (e: SchoolEvent[]) => void
  packingItems: PackingItem[]
  setPackingItems: (p: PackingItem[]) => void
  currentMonth: Date
  setCurrentMonth: (d: Date) => void
}

export const useAppStore = create<AppState>((set) => ({
  selectedChildId: null,
  setSelectedChildId: id => set({ selectedChildId: id }),
  children: [],
  setChildren: children => set({ children }),
  pattern: null,
  setPattern: pattern => set({ pattern }),
  overrides: [],
  setOverrides: overrides => set({ overrides }),
  requests: [],
  setRequests: requests => set({ requests }),
  invitations: [],
  setInvitations: invitations => set({ invitations }),
  notes: [],
  setNotes: notes => set({ notes }),
  events: [],
  setEvents: events => set({ events }),
  packingItems: [],
  setPackingItems: packingItems => set({ packingItems }),
  currentMonth: new Date(),
  setCurrentMonth: currentMonth => set({ currentMonth }),
}))
