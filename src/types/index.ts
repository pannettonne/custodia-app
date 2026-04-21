export interface User {
  uid: string
  email: string
  displayName: string
  photoURL?: string
}

export type CollaboratorLabel = 'caregiver' | 'family' | 'other'
export type CollaboratorCalendarAccess = 'assigned_only' | 'all'

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

export type RequestStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled'

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
  inviteType?: 'parent' | 'collaborator'
  collaboratorLabel?: CollaboratorLabel
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
  documentIds?: string[]
  createdAt: Date
  updatedAt?: Date
}

export type EventCategory =
  | 'reunion'
  | 'excursion'
  | 'examen'
  | 'extraescolar'
  | 'festivo'
  | 'vacaciones'
  | 'otro'

export type EventRecurrence = 'none' | 'weekly' | 'monthly'
export type EventAssignmentStatus = 'pending' | 'accepted' | 'rejected'
export type EventReminderAudience = 'self' | 'both'
export type NotificationTargetTab =
  | 'calendar'
  | 'requests'
  | 'notes'
  | 'events'
  | 'documents'
  | 'packing'
  | 'stats'
  | 'settings'
export type NotificationChannel = 'off' | 'in_app' | 'push' | 'both'

export interface UserNotificationSettings {
  uid: string
  changes: NotificationChannel
  assignments: NotificationChannel
  reminders: NotificationChannel
  notes: NotificationChannel
  updatedAt?: Date
}

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
  assignedParentId?: string
  assignmentStatus?: EventAssignmentStatus
  assignmentRequestedBy?: string
  assignmentRequestedByName?: string
  assignmentRequestToParentId?: string
  custodyOverrideReason?: string
  deletionRequestStatus?: 'pending' | 'rejected'
  deletionRequestedBy?: string
  deletionRequestedByName?: string
  deletionRequestToParentId?: string
  reminderEnabled?: boolean
  reminderDaysBefore?: number
  reminderAudience?: EventReminderAudience
  locationName?: string
  locationAddress?: string
  locationLatitude?: number
  locationLongitude?: number
  locationPlaceId?: string
  documentIds?: string[]
  createdAt: Date
  updatedAt?: Date
}

export interface AppNotification {
  id: string
  userId: string
  childId?: string
  childName?: string
  type:
    | 'event_reminder'
    | 'pending_request'
    | 'special_period_start'
    | 'event_assignment_pending'
    | 'event_assignment_response'
  title: string
  body: string
  dateKey: string
  read: boolean
  createdAt: Date
  targetTab?: NotificationTargetTab
  targetDate?: string
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

export interface UserDocumentKey {
  uid: string
  publicKey: string
  algorithm: 'RSA-OAEP-256'
  updatedAt?: Date
}

export type DocumentShareScope = 'all_parents' | 'only_me'

export interface DocumentFolder {
  id: string
  childId: string
  name: string
  createdBy: string
  createdByName: string
  shareScope: DocumentShareScope
  parentFolderId?: string
  hiddenForUserIds?: string[]
  createdAt: Date
  updatedAt?: Date
}

export interface DocumentFile {
  id: string
  childId: string
  createdBy: string
  createdByName: string
  title?: string
  filenameEncrypted: string
  filenameIv: string
  mimeType: string
  sizeBytes: number
  blobUrl: string
  blobPath: string
  contentHash: string
  iv: string
  encryptedFileKeys: Record<string, string>
  shareScope: DocumentShareScope
  folderId?: string
  hiddenForUserIds?: string[]
  pendingRecipientIds?: string[]
  createdAt: Date
  updatedAt?: Date
}
