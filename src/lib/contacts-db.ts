"use client"

import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, updateDoc, where, type Unsubscribe } from 'firebase/firestore'
import { db } from './firebase'
import type { ChildContact } from '@/types'

function compactUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined)) as Partial<T>
}

export function subscribeToContactsForUser(uid: string, cb: (items: ChildContact[]) => void): Unsubscribe {
  const q = query(collection(db, 'contacts'), where('visibleToUserIds', 'array-contains', uid))
  return onSnapshot(q, snap => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as ChildContact))
    items.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '') || ((b.updatedAt?.seconds ?? 0) - (a.updatedAt?.seconds ?? 0)))
    cb(items)
  })
}

export async function createContact(data: Omit<ChildContact, 'id' | 'createdAt' | 'updatedAt'>) {
  const ref = await addDoc(collection(db, 'contacts'), compactUndefined({
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }))
  return ref.id
}

export async function updateContact(id: string, data: Partial<ChildContact>) {
  await updateDoc(doc(db, 'contacts', id), compactUndefined({
    ...data,
    updatedAt: serverTimestamp(),
  }))
}

export async function deleteContact(id: string) {
  await deleteDoc(doc(db, 'contacts', id))
}
