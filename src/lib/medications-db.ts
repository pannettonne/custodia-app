"use client"

import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, updateDoc, where, type Unsubscribe, setDoc } from 'firebase/firestore'
import { db } from './firebase'
import type { MedicationLog, MedicationPlan, MedicationLogStatus } from '@/types'
import { buildMedicationLogId } from './medications'

function byCreatedAtDesc<T extends { createdAt?: any }>(items: T[]) {
  return [...items].sort((a: any, b: any) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
}

export function subscribeToMedicationPlans(childId: string, cb: (items: MedicationPlan[]) => void): Unsubscribe {
  const q = query(collection(db, 'medications'), where('childId', '==', childId))
  return onSnapshot(q, snap => cb(byCreatedAtDesc(snap.docs.map(d => ({ id: d.id, ...d.data() } as MedicationPlan)))))
}

export function subscribeToMedicationLogs(childId: string, cb: (items: MedicationLog[]) => void): Unsubscribe {
  const q = query(collection(db, 'medicationLogs'), where('childId', '==', childId))
  return onSnapshot(q, snap => cb(byCreatedAtDesc(snap.docs.map(d => ({ id: d.id, ...d.data() } as MedicationLog)))))
}

export async function createMedicationPlan(data: Omit<MedicationPlan, 'id' | 'createdAt' | 'updatedAt'>) {
  const ref = await addDoc(collection(db, 'medications'), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateMedicationPlan(id: string, data: Partial<MedicationPlan>) {
  await updateDoc(doc(db, 'medications', id), {
    ...data,
    updatedAt: serverTimestamp(),
  })
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
  await setDoc(doc(db, 'medicationLogs', logId), {
    childId: input.childId,
    medicationId: input.medicationId,
    medicationName: input.medicationName,
    scheduledAt: input.scheduledAt,
    scheduledDate: input.scheduledAt.slice(0, 10),
    scheduledTime: input.scheduledAt.slice(11, 16),
    status: input.status,
    actedBy: input.actedBy,
    actedByName: input.actedByName,
    note: input.note || undefined,
    actedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true })
}
