import { create } from 'zustand'
import type { Child, CustodyPattern, CustodyOverride, ChangeRequest, Invitation, Note, SchoolEvent, PackingItem, SpecialPeriod, AppNotification, DocumentFile } from '@/types'

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
  notifications: AppNotification[]
  setNotifications: (n: AppNotification[]) => void
  documents: DocumentFile[]
  setDocuments: (d: DocumentFile[]) => void
  packingItems: PackingItem[]
  setPackingItems: (p: PackingItem[]) => void
  specialPeriods: SpecialPeriod[]
  setSpecialPeriods: (s: SpecialPeriod[]) => void
  currentMonth: Date
  setCurrentMonth: (d: Date) => void
  selectedCalendarDate: string | null
  setSelectedCalendarDate: (d: string | null) => void
  refreshEvents: () => void
  refreshNotes: () => void
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
  notifications: [],
  setNotifications: notifications => set({ notifications }),
  documents: [],
  setDocuments: documents => set({ documents }),
  packingItems: [],
  setPackingItems: packingItems => set({ packingItems }),
  specialPeriods: [],
  setSpecialPeriods: specialPeriods => set({ specialPeriods }),
  currentMonth: new Date(),
  setCurrentMonth: currentMonth => set({ currentMonth }),
  selectedCalendarDate: null,
  setSelectedCalendarDate: selectedCalendarDate => set({ selectedCalendarDate }),
  refreshEvents: () => {},
  refreshNotes: () => {},
}))
