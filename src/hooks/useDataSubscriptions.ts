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

export function useDataSubscriptions() {
  const { user } = useAuth()
  const {
    selectedChildId,
    children,
    setChildren, setPattern, setOverrides, setRequests,
    setInvitations, setNotes, setEvents, setPackingItems, setSpecialPeriods,
    setSelectedChildId, setNotifications, setDocuments, setDocumentFolders,
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
  }, [user?.email])

  useEffect(() => {
    if (!user?.uid) return
    return subscribeToNotifications(user.uid, setNotifications)
  }, [user?.uid])

  useEffect(() => {
    const selectedChild = children.find(child => child.id === selectedChildId)
    const isParent = !!selectedChild && selectedChild.parents.includes(user?.uid || '')

    if (!selectedChildId || !user?.uid || !isParent) {
      setPattern(null); setOverrides([]); setRequests([])
      setNotes([]); setEvents([]); setDocuments([]); setDocumentFolders([]); setPackingItems([]); setSpecialPeriods([])
      return
    }
    const u1 = subscribeToPattern(selectedChildId, setPattern)
    const u2 = subscribeToOverrides(selectedChildId, setOverrides)
    const u3 = subscribeToRequests(selectedChildId, setRequests)
    const u4 = subscribeToNotes(selectedChildId, setNotes)
    const u5 = subscribeToEvents(selectedChildId, setEvents)
    const u6 = subscribeToDocuments(selectedChildId, user.uid, setDocuments)
    const u7 = subscribeToDocumentFolders(selectedChildId, user.uid, setDocumentFolders)
    const u8 = subscribeToPackingItems(selectedChildId, setPackingItems)
    const u9 = subscribeToSpecialPeriods(selectedChildId, setSpecialPeriods)
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); u8(); u9() }
  }, [selectedChildId, user?.uid, children])
}
