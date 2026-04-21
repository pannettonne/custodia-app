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

export function useDataSubscriptions() {
  const { user } = useAuth()
  const {
    selectedChildId,
    setChildren, setPattern, setOverrides, setRequests,
    setInvitations, setNotes, setEvents, setPackingItems, setSpecialPeriods,
    setSelectedChildId, setNotifications, setDocuments, setDocumentFolders,
  } = useAppStore()

  useEffect(() => {
    if (!user) return
    return subscribeToChildren(user.uid, kids => {
      setChildren(kids)
      if (kids.length > 0 && !selectedChildId) setSelectedChildId(kids[0].id)
    })
  }, [user?.uid])

  useEffect(() => {
    if (!user?.email) return
    return subscribeToInvitations(user.email, setInvitations)
  }, [user?.email])

  useEffect(() => {
    if (!user?.uid) return
    return subscribeToNotifications(user.uid, setNotifications)
  }, [user?.uid])

  useEffect(() => {
    if (!selectedChildId || !user?.uid) {
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
  }, [selectedChildId, user?.uid])
}
