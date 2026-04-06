export interface User {
  uid: string
  email: string
  displayName: string
  photoURL?: string
}

export interface Child {
  id: string
  name: string
  birthDate: string
  createdBy: string
  parents: string[]
  parentEmails: string[]
  parentNames: Record<string, string>
  parentColors: Record<string, string>
  createdAt: Date
}

export interface CustodyPattern {
  id: string
  childId: string
  type: 'alternating_weekly' | 'alternating_biweekly' | '2-2-3' | 'custom'
  startDate: string
  startParentId: string
  createdBy: string
  createdAt: Date
}

export interface CustodyOverride {
  id: string
  childId: string
  date: string
  parentId: string
  reason?: string
  createdBy: string
  createdAt: Date
}

export type RequestStatus = 'pending' | 'accepted' | 'rejected'

export interface ChangeRequest {
  id: string
  childId: string
  fromParentId: string
  fromParentName: string
  toParentId: string
  type: 'single' | 'range'
  date?: string
  startDate?: string
  endDate?: string
  reason: string
  status: RequestStatus
  createdAt: Date
  respondedAt?: Date
}

export interface Invitation {
  id: string
  childId: string
  childName: string
  fromEmail: string
  fromName: string
  toEmail: string
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled'
  createdAt: Date
}

export type NoteTag = 'info' | 'importante' | 'urgente'

export interface Note {
  id: string
  childId: string
  createdBy: string
  createdByName: string
  type: 'single' | 'range'
  date?: string
  startDate?: string
  endDate?: string
  text: string
  tag: NoteTag
  mentionOther: boolean
  read: boolean
  createdAt: Date
  updatedAt?: Date
}

export type EventCategory = 'reunion' | 'excursion' | 'examen' | 'extraescolar' | 'festivo' | 'otro'
export type EventRecurrence = 'none' | 'weekly' | 'monthly'

export interface SchoolEvent {
  id: string
  childId: string
  createdBy: string
  title: string
  category: EventCategory
  customCategory?: string
  date: string
  endDate?: string
  allDay: boolean
  time?: string
  notes?: string
  recurrence?: EventRecurrence
  recurrenceUntil?: string
  recurrenceWeekdays?: number[]
  cancelledDates?: string[]
  recurrenceGroupId?: string
  createdAt: Date
  updatedAt?: Date
}

export type ItemLocation = 'casa1' | 'casa2' | 'desconocido'

export interface PackingItem {
  id: string
  childId: string
  name: string
  category: 'ropa' | 'escolar' | 'ocio' | 'salud' | 'otro'
  location: ItemLocation
  isRecurring: boolean
  notes?: string
  createdBy: string
  updatedAt: Date
}

export type SpecialPeriodLabel = 'verano' | 'navidad' | 'semana_santa' | 'pascua' | 'otro'

export interface SpecialPeriod {
  id: string
  childId: string
  label: SpecialPeriodLabel
  customLabel?: string
  startDate: string
  endDate: string
  parentId: string
  notes?: string
  createdBy: string
  createdAt: Date
}
