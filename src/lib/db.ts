"use client"
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
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import type { Child, CustodyPattern, CustodyOverride, ChangeRequest, Invitation, Note, SchoolEvent, PackingItem, SpecialPeriod } from '@/types'

// ─── Children ────────────────────────────────────────────────────────────────

export function subscribeToChildren(uid: string, cb: (children: Child[]) => void): Unsubscribe {
  const q = query(collection(db, 'children'), where('parents', 'array-contains', uid))
  return onSnapshot(q, snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as Child))))
}

export async function createChild(data: Omit<Child, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'children'), { ...data, createdAt: serverTimestamp() })
  return ref.id
}

export async function updateChild(id: string, data: Partial<Child>): Promise<void> {
  await updateDoc(doc(db, 'children', id), data)
}

// ─── Custody Pattern ─────────────────────────────────────────────────────────

export function subscribeToPattern(childId: string, cb: (pattern: CustodyPattern | null) => void): Unsubscribe {
  const q = query(collection(db, 'custodyPatterns'), where('childId', '==', childId))
  return onSnapshot(q, snap => {
    if (snap.empty) cb(null)
    else { const d = snap.docs[0]; cb({ id: d.id, ...d.data() } as CustodyPattern) }
  })
}

export async function setPattern(data: Omit<CustodyPattern, 'id' | 'createdAt'>): Promise<void> {
  const q = query(collection(db, 'custodyPatterns'), where('childId', '==', data.childId))
  const snap = await getDocs(q)
  if (!snap.empty) await updateDoc(snap.docs[0].ref, { ...data })
  else await addDoc(collection(db, 'custodyPatterns'), { ...data, createdAt: serverTimestamp() })
}

// ─── Overrides ────────────────────────────────────────────────────────────────

export function subscribeToOverrides(childId: string, cb: (overrides: CustodyOverride[]) => void): Unsubscribe {
  // No orderBy → no composite index needed; sort client-side
  const q = query(collection(db, 'custodyOverrides'), where('childId', '==', childId))
  return onSnapshot(q, snap => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as CustodyOverride))
    cb(items.sort((a, b) => a.date.localeCompare(b.date)))
  })
}

export async function setOverride(data: Omit<CustodyOverride, 'id' | 'createdAt'>): Promise<void> {
  const q = query(collection(db, 'custodyOverrides'), where('childId', '==', data.childId), where('date', '==', data.date))
  const snap = await getDocs(q)
  if (!snap.empty) await updateDoc(snap.docs[0].ref, { parentId: data.parentId, reason: data.reason })
  else await addDoc(collection(db, 'custodyOverrides'), { ...data, createdAt: serverTimestamp() })
}

// ─── Change Requests ─────────────────────────────────────────────────────────

export function subscribeToRequests(childId: string, cb: (requests: ChangeRequest[]) => void): Unsubscribe {
  const q = query(collection(db, 'changeRequests'), where('childId', '==', childId))
  return onSnapshot(q, snap => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as ChangeRequest))
    cb(items.sort((a: any, b: any) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)))
  })
}

export async function createChangeRequest(data: Omit<ChangeRequest, 'id' | 'createdAt' | 'status'>): Promise<string> {
  const ref = await addDoc(collection(db, 'changeRequests'), { ...data, status: 'pending', createdAt: serverTimestamp() })
  return ref.id
}

export async function respondToRequest(id: string, status: 'accepted' | 'rejected'): Promise<void> {
  await updateDoc(doc(db, 'changeRequests', id), { status, respondedAt: serverTimestamp() })
}

// ─── Invitations ──────────────────────────────────────────────────────────────

export function subscribeToInvitations(email: string, cb: (invitations: Invitation[]) => void): Unsubscribe {
  const q = query(collection(db, 'invitations'), where('toEmail', '==', email), where('status', '==', 'pending'))
  return onSnapshot(q, snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as Invitation))))
}

export async function createInvitation(data: Omit<Invitation, 'id' | 'createdAt' | 'status'>): Promise<string> {
  const ref = await addDoc(collection(db, 'invitations'), { ...data, status: 'pending', createdAt: serverTimestamp() })
  return ref.id
}

export async function acceptInvitation(inv: Invitation, uid: string, displayName: string): Promise<void> {
  await updateDoc(doc(db, 'invitations', inv.id), { status: 'accepted' })
  const childRef = doc(db, 'children', inv.childId)
  const childSnap = await getDoc(childRef)
  if (!childSnap.exists()) throw new Error('Menor no encontrado')
  const childData = childSnap.data() as Child
  const parents = [...(childData.parents || []), uid]
  const parentEmails = [...(childData.parentEmails || []), inv.toEmail]
  const parentNames = { ...(childData.parentNames || {}), [uid]: displayName }
  const parentColors = { ...(childData.parentColors || {}) }
  const usedColors = Object.values(parentColors)
  const availableColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']
  parentColors[uid] = availableColors.find(c => !usedColors.includes(c)) || '#6B7280'
  await updateDoc(childRef, { parents, parentEmails, parentNames, parentColors })
}

// ─── Notes ────────────────────────────────────────────────────────────────────

export function subscribeToNotes(childId: string, cb: (notes: Note[]) => void): Unsubscribe {
  const q = query(collection(db, 'notes'), where('childId', '==', childId))
  return onSnapshot(q, snap => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as Note))
    cb(items.sort((a: any, b: any) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)))
  })
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
  const q = query(collection(db, 'schoolEvents'), where('childId', '==', childId))
  return onSnapshot(q, snap => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as SchoolEvent))
    cb(items.sort((a, b) => a.date.localeCompare(b.date)))
  })
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

// ─── Special Periods ──────────────────────────────────────────────────────────

export function subscribeToSpecialPeriods(childId: string, cb: (periods: SpecialPeriod[]) => void): Unsubscribe {
  const q = query(collection(db, 'specialPeriods'), where('childId', '==', childId))
  return onSnapshot(q, snap => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as SpecialPeriod))
    cb(items.sort((a, b) => a.startDate.localeCompare(b.startDate)))
  })
}

export async function createSpecialPeriod(data: Omit<SpecialPeriod, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'specialPeriods'), { ...data, createdAt: serverTimestamp() })
  return ref.id
}

export async function updateSpecialPeriod(id: string, data: Partial<SpecialPeriod>): Promise<void> {
  await updateDoc(doc(db, 'specialPeriods', id), data)
}

export async function deleteSpecialPeriod(id: string): Promise<void> {
  await deleteDoc(doc(db, 'specialPeriods', id))
}
