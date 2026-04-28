"use client"

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import type { AvailabilityBlock } from '@/types'

function sortBlocks(items: AvailabilityBlock[]) {
  return [...items].sort((a, b) => {
    const left = `${a.startDate || a.date || ''}|${a.startTime || '00:00'}`
    const right = `${b.startDate || b.date || ''}|${b.startTime || '00:00'}`
    return left.localeCompare(right)
  })
}

export function subscribeToAvailabilityBlocks(childId: string, cb: (items: AvailabilityBlock[]) => void): Unsubscribe {
  const q = query(collection(db, 'availabilityBlocks'), where('childId', '==', childId))
  return onSnapshot(
    q,
    snap => cb(sortBlocks(snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as AvailabilityBlock)))),
    () => cb([])
  )
}

export async function getAvailabilityBlocksForUser(childId: string, userId: string): Promise<AvailabilityBlock[]> {
  const q = query(collection(db, 'availabilityBlocks'), where('childId', '==', childId), where('userId', '==', userId))
  const snap = await getDocs(q)
  return sortBlocks(snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as AvailabilityBlock)))
}

export async function createAvailabilityBlock(data: Omit<AvailabilityBlock, 'id' | 'createdAt'>): Promise<string> {
  const payload = Object.fromEntries(
    Object.entries({
      ...data,
      createdAt: serverTimestamp(),
    }).filter(([, value]) => value !== undefined)
  )
  const ref = await addDoc(collection(db, 'availabilityBlocks'), payload)
  return ref.id
}

export async function deleteAvailabilityBlock(id: string): Promise<void> {
  await deleteDoc(doc(db, 'availabilityBlocks', id))
}
