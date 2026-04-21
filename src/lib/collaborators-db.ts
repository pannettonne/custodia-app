"use client"

import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  updateDoc,
} from 'firebase/firestore'
import { db } from './firebase'
import type { Child, Invitation } from '@/types'

export async function createCollaboratorInvitation(data: Omit<Invitation, 'id' | 'createdAt' | 'status'>): Promise<string> {
  const childRef = doc(db, 'children', data.childId)
  const childSnap = await getDoc(childRef)
  if (!childSnap.exists()) throw new Error('Menor no encontrado')

  const childData = childSnap.data() as Child
  const normalizedEmail = data.toEmail.trim().toLowerCase()
  const collaboratorEmails = Array.isArray((childData as any).collaboratorEmails) ? [...((childData as any).collaboratorEmails as string[])] : []
  if (!collaboratorEmails.includes(normalizedEmail)) {
    collaboratorEmails.push(normalizedEmail)
    await updateDoc(childRef, { collaboratorEmails })
  }

  const ref = await addDoc(collection(db, 'invitations'), {
    ...data,
    inviteType: 'collaborator',
    fromEmail: data.fromEmail.trim().toLowerCase(),
    toEmail: normalizedEmail,
    status: 'pending',
    createdAt: new Date(),
  })
  return ref.id
}

export async function acceptCollaboratorInvitation(inv: Invitation, uid: string, displayName: string): Promise<void> {
  const childRef = doc(db, 'children', inv.childId)
  const childSnap = await getDoc(childRef)
  if (!childSnap.exists()) throw new Error('Menor no encontrado')

  await updateDoc(childRef, {
    collaborators: arrayUnion(uid),
    [`collaboratorNames.${uid}`]: displayName,
    [`collaboratorLabels.${uid}`]: inv.collaboratorLabel || 'other',
    [`collaboratorDocumentAccess.${uid}`]: false,
    [`collaboratorCalendarAccess.${uid}`]: 'assigned_only',
    [`collaboratorCalendarApprovedBy.${uid}`]: [],
  })

  await updateDoc(doc(db, 'invitations', inv.id), { status: 'accepted' })
}
