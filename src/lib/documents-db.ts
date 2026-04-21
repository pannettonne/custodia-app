"use client"

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import type { DocumentFile, UserDocumentKey } from '@/types'

export function subscribeToDocuments(childId: string, cb: (documents: DocumentFile[]) => void): Unsubscribe {
  const q = query(collection(db, 'documents'), where('childId', '==', childId))
  return onSnapshot(
    q,
    snap => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as DocumentFile))
      items.sort((a: any, b: any) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
      cb(items)
    },
    error => {
      console.error('Documents subscription failed', error)
      cb([])
    }
  )
}

export async function createDocumentRecord(data: Omit<DocumentFile, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'documents'), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function deleteDocumentRecord(id: string): Promise<void> {
  await deleteDoc(doc(db, 'documents', id))
}

export async function getChildParentIds(childId: string): Promise<string[]> {
  const snap = await getDoc(doc(db, 'children', childId))
  if (!snap.exists()) throw new Error('Menor no encontrado')
  const data = snap.data() as { parents?: string[] }
  return Array.isArray(data.parents) ? data.parents : []
}

export async function ensureUserDocumentKey(uid: string, publicKey: string): Promise<void> {
  await setDoc(doc(db, 'userDocumentKeys', uid), {
    uid,
    publicKey,
    algorithm: 'RSA-OAEP-256',
    updatedAt: serverTimestamp(),
  }, { merge: true })
}

export async function getUserDocumentKeys(userIds: string[]): Promise<Record<string, UserDocumentKey>> {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)))
  const snaps = await Promise.all(uniqueIds.map(uid => getDoc(doc(db, 'userDocumentKeys', uid))))
  const entries = snaps
    .filter(snap => snap.exists())
    .map(snap => {
      const data = snap.data() as UserDocumentKey
      return [data.uid, data] as const
    })
  return Object.fromEntries(entries)
}
