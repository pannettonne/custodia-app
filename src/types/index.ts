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
