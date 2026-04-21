"use client"

import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import type { CollaboratorAssignment } from '@/types'

export function subscribeToCollaboratorAssignmentsForParent(childId: string, cb: (items: CollaboratorAssignment[]) => void): Unsubscribe {
  const q = query(collection(db, 'collaboratorAssignments'), where('childId', '==', childId), orderBy('createdAt', 'desc'))
  return onSnapshot(q, snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as CollaboratorAssignment))))
}

export function subscribeToCollaboratorAssignmentsForCollaborator(childId: string, collaboratorId: string, cb: (items: CollaboratorAssignment[]) => void): Unsubscribe {
  const q = query(
    collection(db, 'collaboratorAssignments'),
    where('childId', '==', childId),
    where('collaboratorId', '==', collaboratorId),
    orderBy('createdAt', 'desc')
  )
  return onSnapshot(q, snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as CollaboratorAssignment))))
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
