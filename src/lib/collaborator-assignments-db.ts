"use client"

import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import type { CollaboratorAssignment } from '@/types'

function sortAssignments(items: CollaboratorAssignment[]) {
  return [...items].sort((a, b) => {
    const left = typeof (a as any).createdAt?.toMillis === 'function' ? (a as any).createdAt.toMillis() : new Date((a as any).createdAt || 0).getTime()
    const right = typeof (b as any).createdAt?.toMillis === 'function' ? (b as any).createdAt.toMillis() : new Date((b as any).createdAt || 0).getTime()
    return right - left
  })
}

export function subscribeToCollaboratorAssignmentsForParent(childId: string, cb: (items: CollaboratorAssignment[]) => void): Unsubscribe {
  const q = query(collection(db, 'collaboratorAssignments'), where('childId', '==', childId))
  return onSnapshot(
    q,
    snap => cb(sortAssignments(snap.docs.map(d => ({ id: d.id, ...d.data() } as CollaboratorAssignment)))),
    () => cb([])
  )
}

export function subscribeToCollaboratorAssignmentsForCollaborator(childId: string, collaboratorId: string, cb: (items: CollaboratorAssignment[]) => void): Unsubscribe {
  const q = query(
    collection(db, 'collaboratorAssignments'),
    where('childId', '==', childId),
    where('collaboratorId', '==', collaboratorId)
  )
  return onSnapshot(
    q,
    snap => cb(sortAssignments(snap.docs.map(d => ({ id: d.id, ...d.data() } as CollaboratorAssignment)))),
    () => cb([])
  )
}

export async function createCollaboratorAssignment(data: Omit<CollaboratorAssignment, 'id' | 'createdAt' | 'respondedAt' | 'status'>): Promise<string> {
  const payload = Object.fromEntries(
    Object.entries({
      ...data,
      status: 'pending',
      createdAt: serverTimestamp(),
    }).filter(([, value]) => value !== undefined)
  )

  const ref = await addDoc(collection(db, 'collaboratorAssignments'), payload)
  return ref.id
}

export async function respondToCollaboratorAssignment(id: string, status: 'accepted' | 'rejected'): Promise<void> {
  await updateDoc(doc(db, 'collaboratorAssignments', id), {
    status,
    respondedAt: serverTimestamp(),
  })
}

export async function cancelCollaboratorAssignment(id: string): Promise<void> {
  await updateDoc(doc(db, 'collaboratorAssignments', id), {
    status: 'cancelled',
    respondedAt: serverTimestamp(),
  })
}
