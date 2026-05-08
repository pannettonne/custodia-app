"use client"

import { deleteField, doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from './firebase'
import type { ChangeRequest } from '@/types'

function compactUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined)) as Partial<T>
}

export async function updateChangeRequest(id: string, data: Partial<ChangeRequest>): Promise<void> {
  const payload: Record<string, any> = { ...data }
  if (data.type === 'single') {
    payload.startDate = deleteField()
    payload.endDate = deleteField()
  }
  if (data.type === 'range') {
    payload.date = deleteField()
  }
  await updateDoc(doc(db, 'changeRequests', id), compactUndefined({
    ...payload,
    updatedAt: serverTimestamp(),
  }))
}
