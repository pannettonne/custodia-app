"use client"
import { collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, query, where, onSnapshot, orderBy, limit, serverTimestamp, arrayUnion, arrayRemove, type Unsubscribe, setDoc } from 'firebase/firestore'
import { auth, db } from './firebase'
import type { Child, CustodyPattern, CustodyOverride, ChangeRequest, Invitation, Note, SchoolEvent, PackingItem, SpecialPeriod, AppNotification, RequestStatus, UserNotificationSettings, NotificationChannel } from '@/types'

function compactUndefined<T extends Record<string, any>>(obj: T): Partial<T> { return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined)) as Partial<T> }

const DEFAULT_NOTIFICATION_SETTINGS: Omit<UserNotificationSettings, 'uid'> = {
  changes: 'both',
  assignments: 'both',
  reminders: 'both',
  notes: 'in_app',
}

function mapNotificationTypeToPreferenceKey(type: AppNotification['type']): keyof Omit<UserNotificationSettings, 'uid' | 'updatedAt'> {
  if (type === 'pending_request') return 'changes'
  if (type === 'event_assignment_pending' || type === 'event_assignment_response') return 'assignments'
  if (type === 'event_reminder') return 'reminders'
  return 'changes'
}

async function getUserNotificationSettingsInternal(uid: string): Promise<UserNotificationSettings> {
  const ref = doc(db, 'userNotificationSettings', uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) return { uid, ...DEFAULT_NOTIFICATION_SETTINGS }
  return { uid, ...DEFAULT_NOTIFICATION_SETTINGS, ...(snap.data() as Partial<UserNotificationSettings>) }
}

function allowsInApp(channel: NotificationChannel) {
  return channel === 'in_app' || channel === 'both'
}

function allowsPush(channel: NotificationChannel) {
  return channel === 'push' || channel === 'both'
}

async function maybeDispatchPush(targetUserIds: string[], title: string, body: string, childId?: string, targetTab?: string, targetDate?: string) {
  try {
    const currentUser = auth.currentUser
    if (!currentUser || targetUserIds.length === 0) return
    const idToken = await currentUser.getIdToken()
    await fetch('/api/push/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ userIds: targetUserIds, title, body, childId, targetTab, targetDate }),
    })
  } catch {}
}

export function subscribeToChildren(uid: string, cb: (children: Child[]) => void): Unsubscribe { const q = query(collection(db, 'children'), where('parents', 'array-contains', uid)); return onSnapshot(q, snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as Child)))) }
export async function createChild(data: Omit<Child, 'id' | 'createdAt'>): Promise<string> { const ref = await addDoc(collection(db, 'children'), { ...data, createdAt: serverTimestamp() }); return ref.id }
export async function updateChild(id: string, data: Partial<Child>): Promise<void> { await updateDoc(doc(db, 'children', id), data) }
export async function forgetChild(childId: string, uid: string): Promise<void> { const childRef = doc(db, 'children', childId); const childSnap = await getDoc(childRef); if (!childSnap.exists()) throw new Error('Menor no encontrado'); const child = childSnap.data() as Child; const currentParents = child.parents || []; if (!currentParents.includes(uid)) throw new Error('No tienes acceso a este menor'); if (currentParents.length <= 1) throw new Error('No puedes olvidar el único progenitor del menor'); const index = currentParents.indexOf(uid); const parents = currentParents.filter(p => p !== uid); const parentEmails = [...(child.parentEmails || [])]; if (index >= 0 && index < parentEmails.length) parentEmails.splice(index, 1); const parentNames = { ...(child.parentNames || {}) }; delete parentNames[uid]; const parentColors = { ...(child.parentColors || {}) }; delete parentColors[uid]; await updateDoc(childRef, { parents, parentEmails, parentNames, parentColors }) }

export function subscribeToPattern(childId: string, cb: (pattern: CustodyPattern | null) => void): Unsubscribe { const q = query(collection(db, 'custodyPatterns'), where('childId', '==', childId)); return onSnapshot(q, snap => { if (snap.empty) cb(null); else { const d = snap.docs[0]; cb({ id: d.id, ...d.data() } as CustodyPattern) } }) }
export async function setPattern(data: Omit<CustodyPattern, 'id' | 'createdAt'>): Promise<void> { const q = query(collection(db, 'custodyPatterns'), where('childId', '==', data.childId)); const snap = await getDocs(q); if (!snap.empty) await updateDoc(snap.docs[0].ref, { ...data }); else await addDoc(collection(db, 'custodyPatterns'), { ...data, createdAt: serverTimestamp() }) }
export function subscribeToOverrides(childId: string, cb: (overrides: CustodyOverride[]) => void): Unsubscribe { const q = query(collection(db, 'custodyOverrides'), where('childId', '==', childId)); return onSnapshot(q, snap => { const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as CustodyOverride)); cb(items.sort((a, b) => a.date.localeCompare(b.date))) }) }
export async function setOverride(data: Omit<CustodyOverride, 'id' | 'createdAt'>): Promise<void> { const q = query(collection(db, 'custodyOverrides'), where('childId', '==', data.childId), where('date', '==', data.date)); const snap = await getDocs(q); if (!snap.empty) await updateDoc(snap.docs[0].ref, compactUndefined({ parentId: data.parentId, reason: data.reason, createdBy: data.createdBy })); else await addDoc(collection(db, 'custodyOverrides'), compactUndefined({ ...data, createdAt: serverTimestamp() })) }

export function subscribeToRequests(childId: string, cb: (requests: ChangeRequest[]) => void): Unsubscribe { const q = query(collection(db, 'changeRequests'), where('childId', '==', childId)); return onSnapshot(q, snap => { const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as ChangeRequest)); cb(items.sort((a: any, b: any) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))) }) }
export async function createChangeRequest(data: Omit<ChangeRequest, 'id' | 'createdAt' | 'status'>): Promise<string> { const ref = await addDoc(collection(db, 'changeRequests'), compactUndefined({ ...data, status: 'pending', createdAt: serverTimestamp() })); return ref.id }
export async function respondToRequest(id: string, status: RequestStatus): Promise<void> { await updateDoc(doc(db, 'changeRequests', id), { status, respondedAt: serverTimestamp() }) }
export async function cancelRequest(id: string): Promise<void> { await updateDoc(doc(db, 'changeRequests', id), { status: 'cancelled', respondedAt: serverTimestamp() }) }
export async function deleteRequest(id: string): Promise<void> { await deleteDoc(doc(db, 'changeRequests', id)) }

export function subscribeToInvitations(email: string, cb: (invitations: Invitation[]) => void): Unsubscribe { const normalized = email.trim().toLowerCase(); let received: Invitation[] = []; let sent: Invitation[] = []; const emit = () => { const merged = [...received, ...sent]; const unique = Array.from(new Map(merged.map(i => [i.id, i])).values()); unique.sort((a: any, b: any) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)); cb(unique) }; const q1 = query(collection(db, 'invitations'), where('toEmail', '==', normalized)); const q2 = query(collection(db, 'invitations'), where('fromEmail', '==', normalized)); const u1 = onSnapshot(q1, snap => { received = snap.docs.map(d => ({ id: d.id, ...d.data() } as Invitation)); emit() }); const u2 = onSnapshot(q2, snap => { sent = snap.docs.map(d => ({ id: d.id, ...d.data() } as Invitation)); emit() }); return () => { u1(); u2() } }
export async function createInvitation(data: Omit<Invitation, 'id' | 'createdAt' | 'status'>): Promise<string> { const childRef = doc(db, 'children', data.childId); const childSnap = await getDoc(childRef); if (!childSnap.exists()) throw new Error('Menor no encontrado'); const childData = childSnap.data() as Child; const normalizedEmail = data.toEmail.trim().toLowerCase(); const parentEmails = Array.isArray(childData.parentEmails) ? [...childData.parentEmails] : []; if (!parentEmails.includes(normalizedEmail)) { parentEmails.push(normalizedEmail); await updateDoc(childRef, { parentEmails }) } const ref = await addDoc(collection(db, 'invitations'), { ...data, fromEmail: data.fromEmail.trim().toLowerCase(), toEmail: normalizedEmail, status: 'pending', createdAt: serverTimestamp() }); return ref.id }
export async function resendInvitation(invitationId: string): Promise<void> { await updateDoc(doc(db, 'invitations', invitationId), { status: 'pending', createdAt: serverTimestamp() }) }
export async function cancelInvitation(invitationId: string): Promise<void> { await updateDoc(doc(db, 'invitations', invitationId), { status: 'cancelled' }) }
export async function acceptInvitation(inv: Invitation, uid: string, displayName: string): Promise<void> { const childRef = doc(db, 'children', inv.childId); const childSnap = await getDoc(childRef); if (!childSnap.exists()) throw new Error('Menor no encontrado'); const childData = childSnap.data() as Child; const parentEmails = Array.isArray(childData.parentEmails) ? [...childData.parentEmails] : []; if (!parentEmails.includes(inv.toEmail)) throw new Error('Esta invitación es antigua o incompleta. Reenvíala desde ajustes y acepta la nueva.'); const parents = Array.from(new Set([...(childData.parents || []), uid])); const mergedParentEmails = Array.from(new Set([...(childData.parentEmails || []), inv.toEmail])); const parentNames = { ...(childData.parentNames || {}), [uid]: displayName }; const parentColors = { ...(childData.parentColors || {}) }; const usedColors = Object.values(parentColors); const availableColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']; parentColors[uid] = parentColors[uid] || availableColors.find(c => !usedColors.includes(c)) || '#6B7280'; await updateDoc(childRef, { parents, parentEmails: mergedParentEmails, parentNames, parentColors }); await updateDoc(doc(db, 'invitations', inv.id), { status: 'accepted' }) }

export function subscribeToNotes(childId: string, cb: (notes: Note[]) => void): Unsubscribe { const q = query(collection(db, 'notes'), where('childId', '==', childId)); return onSnapshot(q, snap => { const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as Note)); cb(items.sort((a: any, b: any) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))) }) }
export async function createNote(data: Omit<Note, 'id' | 'createdAt'>): Promise<string> { const ref = await addDoc(collection(db, 'notes'), compactUndefined({ ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })); return ref.id }
export async function updateNote(id: string, data: Partial<Note>): Promise<void> { await updateDoc(doc(db, 'notes', id), compactUndefined({ ...data, updatedAt: serverTimestamp() })) }
export async function deleteNote(id: string): Promise<void> { await deleteDoc(doc(db, 'notes', id)) }
export async function markNoteRead(id: string): Promise<void> { await updateDoc(doc(db, 'notes', id), { read: true }) }

export function subscribeToEvents(childId: string, cb: (events: SchoolEvent[]) => void): Unsubscribe { const q = query(collection(db, 'schoolEvents'), where('childId', '==', childId)); return onSnapshot(q, snap => { const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as SchoolEvent)); cb(items.sort((a, b) => a.date.localeCompare(b.date) || ((a.time || '').localeCompare(b.time || '')))) }) }
export async function createEvent(data: Omit<SchoolEvent, 'id' | 'createdAt'>): Promise<string> { const ref = await addDoc(collection(db, 'schoolEvents'), compactUndefined({ ...data, time: data.allDay ? undefined : (data.time || undefined), endDate: data.endDate || undefined, notes: data.notes || undefined, customCategory: data.category === 'otro' ? (data.customCategory || undefined) : undefined, cancelledDates: data.cancelledDates || [], createdAt: serverTimestamp(), updatedAt: serverTimestamp() })); return ref.id }
export async function updateEvent(id: string, data: Partial<SchoolEvent>): Promise<void> { await updateDoc(doc(db, 'schoolEvents', id), compactUndefined({ ...data, customCategory: data.category === 'otro' ? data.customCategory : (data.customCategory || undefined), updatedAt: serverTimestamp() })) }
export async function cancelEventOccurrence(id: string, date: string): Promise<void> { await updateDoc(doc(db, 'schoolEvents', id), { cancelledDates: arrayUnion(date), updatedAt: serverTimestamp() }) }
export async function restoreEventOccurrence(id: string, date: string): Promise<void> { await updateDoc(doc(db, 'schoolEvents', id), { cancelledDates: arrayRemove(date), updatedAt: serverTimestamp() }) }
export async function deleteEvent(id: string): Promise<void> { await deleteDoc(doc(db, 'schoolEvents', id)) }

export function subscribeToNotifications(uid: string, cb: (notifications: AppNotification[]) => void): Unsubscribe { const q = query(collection(db, 'notifications'), where('userId', '==', uid), orderBy('createdAt', 'desc'), limit(50)); return onSnapshot(q, snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as AppNotification)))) }
export async function createNotification(data: Omit<AppNotification, 'id' | 'createdAt' | 'read'>): Promise<string> {
  const settings = await getUserNotificationSettingsInternal(data.userId)
  const preferenceKey = mapNotificationTypeToPreferenceKey(data.type)
  const channel = settings[preferenceKey]
  let createdId = ''
  if (allowsInApp(channel)) {
    const ref = await addDoc(collection(db, 'notifications'), compactUndefined({ ...data, read: false, createdAt: serverTimestamp() }))
    createdId = ref.id
  }
  if (allowsPush(channel)) {
    await maybeDispatchPush([data.userId], data.title, data.body, data.childId, data.targetTab, data.targetDate)
  }
  return createdId
}
export async function markNotificationRead(id: string): Promise<void> { await updateDoc(doc(db, 'notifications', id), { read: true }) }
export async function markAllNotificationsRead(uid: string): Promise<void> { const snap = await getDocs(query(collection(db, 'notifications'), where('userId', '==', uid), where('read', '==', false))); await Promise.all(snap.docs.map(d => updateDoc(d.ref, { read: true }))) }
export async function clearReadNotifications(uid: string): Promise<void> { const snap = await getDocs(query(collection(db, 'notifications'), where('userId', '==', uid), where('read', '==', true))); await Promise.all(snap.docs.map(d => deleteDoc(d.ref))) }

export function subscribeToUserNotificationSettings(uid: string, cb: (settings: UserNotificationSettings) => void): Unsubscribe {
  const ref = doc(db, 'userNotificationSettings', uid)
  return onSnapshot(ref, snap => {
    if (!snap.exists()) cb({ uid, ...DEFAULT_NOTIFICATION_SETTINGS })
    else cb({ uid, ...DEFAULT_NOTIFICATION_SETTINGS, ...(snap.data() as Partial<UserNotificationSettings>) })
  })
}
export async function getUserNotificationSettings(uid: string): Promise<UserNotificationSettings> { return getUserNotificationSettingsInternal(uid) }
export async function updateUserNotificationSettings(uid: string, data: Partial<Omit<UserNotificationSettings, 'uid'>>): Promise<void> {
  const ref = doc(db, 'userNotificationSettings', uid)
  await setDoc(ref, compactUndefined({ ...data, updatedAt: serverTimestamp() as any }), { merge: true })
}

export function subscribeToPackingItems(childId: string, cb: (items: PackingItem[]) => void): Unsubscribe { const q = query(collection(db, 'packingItems'), where('childId', '==', childId)); return onSnapshot(q, snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as PackingItem)))) }
export async function createPackingItem(data: Omit<PackingItem, 'id'>): Promise<string> { const ref = await addDoc(collection(db, 'packingItems'), compactUndefined(data)); return ref.id }
export async function updatePackingItem(id: string, data: Partial<PackingItem>): Promise<void> { await updateDoc(doc(db, 'packingItems', id), compactUndefined({ ...data, updatedAt: serverTimestamp() })) }
export async function deletePackingItem(id: string): Promise<void> { await deleteDoc(doc(db, 'packingItems', id)) }

export function subscribeToSpecialPeriods(childId: string, cb: (periods: SpecialPeriod[]) => void): Unsubscribe { const q = query(collection(db, 'specialPeriods'), where('childId', '==', childId)); return onSnapshot(q, snap => { const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as SpecialPeriod)); cb(items.sort((a, b) => a.startDate.localeCompare(b.startDate))) }) }
export async function createSpecialPeriod(data: Omit<SpecialPeriod, 'id' | 'createdAt'>): Promise<string> { const ref = await addDoc(collection(db, 'specialPeriods'), compactUndefined({ ...data, createdAt: serverTimestamp() })); return ref.id }
export async function updateSpecialPeriod(id: string, data: Partial<SpecialPeriod>): Promise<void> { await updateDoc(doc(db, 'specialPeriods', id), compactUndefined(data)) }
export async function deleteSpecialPeriod(id: string): Promise<void> { await deleteDoc(doc(db, 'specialPeriods', id)) }
