'use client'
import { useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import {
  subscribeToChildren, subscribeToPattern, subscribeToOverrides,
  subscribeToRequests, subscribeToInvitations, subscribeToNotes,
  subscribeToEvents, subscribeToPackingItems, subscribeToSpecialPeriods,
  subscribeToNotifications,
} from '@/lib/db'
import { subscribeToDocumentFolders, subscribeToDocuments } from '@/lib/documents-db'
import { subscribeToCollaboratorChildren } from '@/lib/collaborators-db'
import { subscribeToCollaboratorAssignmentsForCollaborator, subscribeToCollaboratorAssignmentsForParent } from '@/lib/collaborator-assignments-db'
import { subscribeToMedicationLogs, subscribeToMedicationPlans } from '@/lib/medications-db'

export function useDataSubscriptions() {
  const { user } = useAuth()
  const {
    selectedChildId,
    children,
    setChildren, setPattern, setOverrides, setRequests, setCollaboratorAssignments,
    setInvitations, setNotes, setEvents, setPackingItems, setSpecialPeriods,
    setSelectedChildId, setNotifications, setDocuments, setDocumentFolders,
    setMedications, setMedicationLogs,
  } = useAppStore()

  useEffect(() => {
    if (!user?.uid) return
    let parentChildren: any[] = []
    let collaboratorChildren: any[] = []
    const syncChildren = () => {
      const merged = Array.from(new Map([...parentChildren, ...collaboratorChildren].map(item => [item.id, item])).values())
      setChildren(merged)
      if (merged.length > 0 && !selectedChildId) setSelectedChildId(merged[0].id)
    }

    const u1 = subscribeToChildren(user.uid, kids => {
      parentChildren = kids
      syncChildren()
    })
    const u2 = subscribeToCollaboratorChildren(user.uid, kids => {
      collaboratorChildren = kids
      syncChildren()
    })
    return () => { u1(); u2() }
  }, [user?.uid, selectedChildId, setChildren, setSelectedChildId])

  useEffect(() => {
    if (!user?.email) return
    return subscribeToInvitations(user.email, setInvitations)
  }, [user?.email, setInvitations])

  useEffect(() => {
    if (!user?.uid) return
    return subscribeToNotifications(user.uid, setNotifications)
  }, [user?.uid, setNotifications])

  useEffect(() => {
    const selectedChild = children.find(child => child.id === selectedChildId)
    const isParent = !!selectedChild && selectedChild.parents.includes(user?.uid || '')
    const isCollaborator = !!selectedChild && !!selectedChild.collaborators?.includes(user?.uid || '')
    const collaboratorCanSeeFullCalendar = !!selectedChild && selectedChild.collaboratorCalendarAccess?.[user?.uid || ''] === 'all'
    const collaboratorCanSeeDocuments = !!selectedChild && !!selectedChild.collaboratorDocumentAccess?.[user?.uid || '']

    if (!selectedChildId || !user?.uid || !selectedChild) {
      setPattern(null); setOverrides([]); setRequests([]); setCollaboratorAssignments([])
      setNotes([]); setEvents([]); setDocuments([]); setDocumentFolders([]); setPackingItems([]); setSpecialPeriods([])
      setMedications([]); setMedicationLogs([])
      return
    }

    const cleanups: Array<() => void> = []

    if (isParent || collaboratorCanSeeFullCalendar) {
      cleanups.push(subscribeToPattern(selectedChildId, setPattern))
      cleanups.push(subscribeToOverrides(selectedChildId, setOverrides))
      cleanups.push(subscribeToSpecialPeriods(selectedChildId, setSpecialPeriods))
    } else {
      setPattern(null)
      setOverrides([])
      setSpecialPeriods([])
    }

    if (isParent) {
      cleanups.push(subscribeToRequests(selectedChildId, setRequests))
      cleanups.push(subscribeToCollaboratorAssignmentsForParent(selectedChildId, setCollaboratorAssignments))
      cleanups.push(subscribeToNotes(selectedChildId, setNotes))
      cleanups.push(subscribeToEvents(selectedChildId, setEvents))
      cleanups.push(subscribeToPackingItems(selectedChildId, setPackingItems))
      cleanups.push(subscribeToDocuments(selectedChildId, user.uid, setDocuments))
      cleanups.push(subscribeToDocumentFolders(selectedChildId, user.uid, setDocumentFolders))
      cleanups.push(subscribeToMedicationPlans(selectedChildId, setMedications))
      cleanups.push(subscribeToMedicationLogs(selectedChildId, setMedicationLogs))
    } else if (isCollaborator) {
      setRequests([])
      setNotes([])
      setEvents([])
      setPackingItems([])
      cleanups.push(subscribeToCollaboratorAssignmentsForCollaborator(selectedChildId, user.uid, setCollaboratorAssignments))
      cleanups.push(subscribeToMedicationPlans(selectedChildId, setMedications))
      cleanups.push(subscribeToMedicationLogs(selectedChildId, setMedicationLogs))
      if (collaboratorCanSeeDocuments) {
        cleanups.push(subscribeToDocuments(selectedChildId, user.uid, setDocuments))
        cleanups.push(subscribeToDocumentFolders(selectedChildId, user.uid, setDocumentFolders))
      } else {
        setDocuments([])
        setDocumentFolders([])
      }
    } else {
      setRequests([])
      setCollaboratorAssignments([])
      setNotes([])
      setEvents([])
      setDocuments([])
      setDocumentFolders([])
      setPackingItems([])
      setMedications([])
      setMedicationLogs([])
    }

    return () => { cleanups.forEach(unsub => unsub()) }
  }, [selectedChildId, user?.uid, children, setPattern, setOverrides, setRequests, setCollaboratorAssignments, setNotes, setEvents, setPackingItems, setSpecialPeriods, setDocuments, setDocumentFolders, setMedications, setMedicationLogs])
}
