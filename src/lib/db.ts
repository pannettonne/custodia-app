import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import type { Child, CustodyPattern, CustodyOverride, ChangeRequest, Invitation, Note, SchoolEvent, PackingItem } from '@/types'

// ─── Children ────────────────────────────────────────────────────────────────

export async function getChildrenForUser(uid: string): Promise<Child[]> {
  const q = query(collection(db, 'children'), where('parents', 'array-contains', uid))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Child))
}

export function subscribeToChildren(uid: string, cb: (children: Child[]) => void): Unsubscribe {
  const q = query(collection(db, 'children'), where('parents', 'array-contains', uid))
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Child)))
  })
}

export async function createChild(data: Omit<Child, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'children'), {
    ...data,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateChild(id: string, data: Partial<Child>): Promise<void> {
  await updateDoc(doc(db, 'children', id), data)
}

// ─── Custody Pattern ─────────────────────────────────────────────────────────

export async function getPatternForChild(childId: string): Promise<CustodyPattern | null> {
  const q = query(collection(db, 'custodyPatterns'), where('childId', '==', childId))
  const snap = await getDocs(q)
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...d.data() } as CustodyPattern
}

export function subscribeToPattern(
  childId: string,
  cb: (pattern: CustodyPattern | null) => void
): Unsubscribe {
  const q = query(collection(db, 'custodyPatterns'), where('childId', '==', childId))
  return onSnapshot(q, (snap) => {
    if (snap.empty) cb(null)
    else {
      const d = snap.docs[0]
      cb({ id: d.id, ...d.data() } as CustodyPattern)
    }
  })
}

export async function setPattern(data: Omit<CustodyPattern, 'id' | 'createdAt'>): Promise<void> {
  const q = query(collection(db, 'custodyPatterns'), where('childId', '==', data.childId))
  const snap = await getDocs(q)
  if (!snap.empty) {
    await updateDoc(snap.docs[0].ref, { ...data })
  } else {
    await addDoc(collection(db, 'custodyPatterns'), {
      ...data,
      createdAt: serverTimestamp(),
    })
  }
}

// ─── Overrides ────────────────────────────────────────────────────────────────

export function subscribeToOverrides(
  childId: string,
  cb: (overrides: CustodyOverride[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'custodyOverrides'),
    where('childId', '==', childId),
    orderBy('date', 'asc')
  )
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CustodyOverride)))
  })
}

export async function setOverride(data: Omit<CustodyOverride, 'id' | 'createdAt'>): Promise<void> {
  const q = query(
    collection(db, 'custodyOverrides'),
    where('childId', '==', data.childId),
    where('date', '==', data.date)
  )
  const snap = await getDocs(q)
  if (!snap.empty) {
    await updateDoc(snap.docs[0].ref, { parentId: data.parentId, reason: data.reason })
  } else {
    await addDoc(collection(db, 'custodyOverrides'), {
      ...data,
      createdAt: serverTimestamp(),
    })
  }
}

// ─── Change Requests ─────────────────────────────────────────────────────────

export function subscribeToRequests(
  childId: string,
  cb: (requests: ChangeRequest[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'changeRequests'),
    where('childId', '==', childId),
    orderBy('createdAt', 'desc')
  )
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChangeRequest)))
  })
}

export async function createChangeRequest(
  data: Omit<ChangeRequest, 'id' | 'createdAt' | 'status'>
): Promise<string> {
  const ref = await addDoc(collection(db, 'changeRequests'), {
    ...data,
    status: 'pending',
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function respondToRequest(
  id: string,
  status: 'accepted' | 'rejected'
): Promise<void> {
  await updateDoc(doc(db, 'changeRequests', id), {
    status,
    respondedAt: serverTimestamp(),
  })
}

// ─── Invitations ──────────────────────────────────────────────────────────────

export async function createInvitation(
  data: Omit<Invitation, 'id' | 'createdAt' | 'status'>
): Promise<string> {
  const ref = await addDoc(collection(db, 'invitations'), {
    ...data,
    status: 'pending',
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function getPendingInvitationsForEmail(email: string): Promise<Invitation[]> {
  const q = query(
    collection(db, 'invitations'),
    where('toEmail', '==', email),
    where('status', '==', 'pending')
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Invitation))
}

export function subscribeToInvitations(
  email: string,
  cb: (invitations: Invitation[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'invitations'),
    where('toEmail', '==', email),
    where('status', '==', 'pending')
  )
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Invitation)))
  })
}

export async function acceptInvitation(inv: Invitation, uid: string, displayName: string): Promise<void> {
  // Marcar invitación como aceptada
  await updateDoc(doc(db, 'invitations', inv.id), { status: 'accepted' })

  // Añadir progenitor al hijo
  const childRef = doc(db, 'children', inv.childId)
  const childSnap = await getDoc(childRef)
  if (!childSnap.exists()) throw new Error('Menor no encontrado')

  const childData = childSnap.data() as Child
  const parents = [...(childData.parents || []), uid]
  const parentEmails = [...(childData.parentEmails || []), inv.toEmail]
  const parentNames = { ...(childData.parentNames || {}), [uid]: displayName }
  const parentColors = { ...(childData.parentColors || {}) }

  // Asignar color si no tiene
  const usedColors = Object.values(parentColors)
  const availableColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']
  const newColor = availableColors.find((c) => !usedColors.includes(c)) || '#6B7280'
  parentColors[uid] = newColor

  await updateDoc(childRef, { parents, parentEmails, parentNames, parentColors })
}

// ─── Notes ────────────────────────────────────────────────────────────────────
export function subscribeToNotes(childId: string, cb: (notes: Note[]) => void): Unsubscribe {
  const q = query(collection(db, 'notes'), where('childId', '==', childId), orderBy('createdAt', 'desc'))
  return onSnapshot(q, snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as Note))))
}

export async function createNote(data: Omit<Note, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'notes'), { ...data, createdAt: serverTimestamp() })
  return ref.id
}

export async function deleteNote(id: string): Promise<void> {
  await deleteDoc(doc(db, 'notes', id))
}

export async function markNoteRead(id: string): Promise<void> {
  await updateDoc(doc(db, 'notes', id), { read: true })
}

// ─── School Events ────────────────────────────────────────────────────────────
export function subscribeToEvents(childId: string, cb: (events: SchoolEvent[]) => void): Unsubscribe {
  const q = query(collection(db, 'schoolEvents'), where('childId', '==', childId), orderBy('date', 'asc'))
  return onSnapshot(q, snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as SchoolEvent))))
}

export async function createEvent(data: Omit<SchoolEvent, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'schoolEvents'), { ...data, createdAt: serverTimestamp() })
  return ref.id
}

export async function deleteEvent(id: string): Promise<void> {
  await deleteDoc(doc(db, 'schoolEvents', id))
}

// ─── Packing Items ────────────────────────────────────────────────────────────
export function subscribeToPackingItems(childId: string, cb: (items: PackingItem[]) => void): Unsubscribe {
  const q = query(collection(db, 'packingItems'), where('childId', '==', childId))
  return onSnapshot(q, snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as PackingItem))))
}

export async function createPackingItem(data: Omit<PackingItem, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'packingItems'), data)
  return ref.id
}

export async function updatePackingItem(id: string, data: Partial<PackingItem>): Promise<void> {
  await updateDoc(doc(db, 'packingItems', id), { ...data, updatedAt: serverTimestamp() })
}

export async function deletePackingItem(id: string): Promise<void> {
  await deleteDoc(doc(db, 'packingItems', id))
}
