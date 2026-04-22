"use client"

import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, updateDoc, where, type Unsubscribe, setDoc } from 'firebase/firestore'
import { db } from './firebase'
import type { MedicationLog, MedicationPlan, MedicationLogStatus } from '@/types'
import { buildMedicationLogId } from './medications'

function compactUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined)) as Partial<T>
}

function sortByCreatedAtDesc<T extends { createdAt?: any }>(items: T[]): T[] {
  return [...items].sort((a: any, b: any) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
}

export function subscribeToMedicationPlans(childId: string, cb: (items: MedicationPlan[]) => void): Unsubscribe {
  const q = query(collection(db, 'medications'), where('childId', '==', childId))
  return onSnapshot(q, snap => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as MedicationPlan))
    cb(sortByCreatedAtDesc(items))
  })
}

export function subscribeToMedicationLogs(childId: string, cb: (items: MedicationLog[]) => void): Unsubscribe {
  const q = query(collection(db, 'medicationLogs'), where('childId', '==', childId))
  return onSnapshot(q, snap => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as MedicationLog))
    cb(sortByCreatedAtDesc(items))
  })
}

export async function createMedicationPlan(data: Omit<MedicationPlan, 'id' | 'createdAt' | 'updatedAt'>) {
  const ref = await addDoc(collection(db, 'medications'), compactUndefined({
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }))
  return ref.id
}

export async function updateMedicationPlan(id: string, data: Partial<MedicationPlan>) {
  await updateDoc(doc(db, 'medications', id), compactUndefined({
    ...data,
    updatedAt: serverTimestamp(),
  }))
}

export async function deleteMedicationPlan(id: string) {
  await deleteDoc(doc(db, 'medications', id))
}

export async function setMedicationLog(input: {
  childId: string
  medicationId: string
  medicationName: string
  scheduledAt: string
  status: MedicationLogStatus
  actedBy: string
  actedByName: string
  note?: string
}) {
  const logId = buildMedicationLogId(input.medicationId, input.scheduledAt)
  await setDoc(doc(db, 'medicationLogs', logId), compactUndefined({
    childId: input.childId,
    medicationId: input.medicationId,
    medicationName: input.medicationName,
    scheduledAt: input.scheduledAt,
    scheduledDate: input.scheduledAt.slice(0, 10),
    scheduledTime: input.scheduledAt.slice(11, 16),
    status: input.status,
    actedBy: input.actedBy,
    actedByName: input.actedByName,
    note: input.note,
    actedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }), { merge: true })
}
