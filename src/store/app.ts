import { create } from 'zustand'
import type { Child, CustodyPattern, CustodyOverride, ChangeRequest, Invitation } from '@/types'

interface AppState {
  // Selected child
  selectedChildId: string | null
  setSelectedChildId: (id: string | null) => void

  // Children list
  children: Child[]
  setChildren: (children: Child[]) => void

  // Current child data
  pattern: CustodyPattern | null
  setPattern: (p: CustodyPattern | null) => void

  overrides: CustodyOverride[]
  setOverrides: (o: CustodyOverride[]) => void

  requests: ChangeRequest[]
  setRequests: (r: ChangeRequest[]) => void

  invitations: Invitation[]
  setInvitations: (i: Invitation[]) => void

  // UI state
  currentMonth: Date
  setCurrentMonth: (d: Date) => void

  // Quick date query
  quickQueryDate: string | null
  setQuickQueryDate: (d: string | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  selectedChildId: null,
  setSelectedChildId: (id) => set({ selectedChildId: id }),

  children: [],
  setChildren: (children) => set({ children }),

  pattern: null,
  setPattern: (pattern) => set({ pattern }),

  overrides: [],
  setOverrides: (overrides) => set({ overrides }),

  requests: [],
  setRequests: (requests) => set({ requests }),

  invitations: [],
  setInvitations: (invitations) => set({ invitations }),

  currentMonth: new Date(),
  setCurrentMonth: (currentMonth) => set({ currentMonth }),

  quickQueryDate: null,
  setQuickQueryDate: (quickQueryDate) => set({ quickQueryDate }),
}))
