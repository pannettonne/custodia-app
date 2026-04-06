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
  createdBy: string // uid del creador
  parents: string[] // array de uids de ambos progenitores
  parentEmails: string[] // emails para invitación
  parentNames: Record<string, string> // uid -> nombre
  parentColors: Record<string, string> // uid -> color '#hex'
  createdAt: Date
}

export interface CustodyPattern {
  id: string
  childId: string
  type: 'alternating_weekly' | 'alternating_biweekly' | '2-2-3' | 'custom'
  startDate: string // ISO date string
  startParentId: string // quién empieza
  createdBy: string
  createdAt: Date
}

export interface CustodyOverride {
  id: string
  childId: string
  date: string // YYYY-MM-DD
  parentId: string // a quién corresponde ese día
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
  date?: string // para tipo single
  startDate?: string // para tipo range
  endDate?: string // para tipo range
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
  status: 'pending' | 'accepted' | 'rejected'
  createdAt: Date
}

// ─── Notas ────────────────────────────────────────────────────────────────────
export type NoteTag = 'info' | 'importante' | 'urgente'

export interface Note {
  id: string
  childId: string
  createdBy: string
  createdByName: string
  type: 'single' | 'range'
  date?: string        // YYYY-MM-DD (tipo single)
  startDate?: string   // tipo range
  endDate?: string     // tipo range
  text: string
  tag: NoteTag
  mentionOther: boolean // true = notifica al otro progenitor
  read: boolean         // leída por el destinatario
  createdAt: Date
}

// ─── Eventos escolares ────────────────────────────────────────────────────────
export type EventCategory = 'reunion' | 'excursion' | 'examen' | 'extraescolar' | 'festivo' | 'otro'

export interface SchoolEvent {
  id: string
  childId: string
  createdBy: string
  title: string
  category: EventCategory
  date: string       // YYYY-MM-DD
  endDate?: string   // si dura varios días
  allDay: boolean
  time?: string      // HH:mm si no es allDay
  notes?: string
  createdAt: Date
}

// ─── Lista de equipaje ────────────────────────────────────────────────────────
export type ItemLocation = 'casa1' | 'casa2' | 'desconocido'

export interface PackingItem {
  id: string
  childId: string
  name: string
  category: 'ropa' | 'escolar' | 'ocio' | 'salud' | 'otro'
  location: ItemLocation
  isRecurring: boolean  // viaja siempre en los cambios
  notes?: string
  createdBy: string
  updatedAt: Date
}
