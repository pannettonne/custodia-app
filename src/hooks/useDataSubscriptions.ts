'use client'
import { useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import { subscribeToChildren, subscribeToPattern, subscribeToOverrides, subscribeToRequests, subscribeToInvitations, subscribeToNotes, subscribeToEvents, subscribeToPackingItems } from '@/lib/db'

export function useDataSubscriptions() {
  const { user } = useAuth()
  const { selectedChildId, setChildren, setPattern, setOverrides, setRequests, setInvitations, setNotes, setEvents, setPackingItems, setSelectedChildId, children } = useAppStore()

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
    if (!selectedChildId) { setPattern(null); setOverrides([]); setRequests([]); setNotes([]); setEvents([]); setPackingItems([]); return }
    const u1 = subscribeToPattern(selectedChildId, setPattern)
    const u2 = subscribeToOverrides(selectedChildId, setOverrides)
    const u3 = subscribeToRequests(selectedChildId, setRequests)
    const u4 = subscribeToNotes(selectedChildId, setNotes)
    const u5 = subscribeToEvents(selectedChildId, setEvents)
    const u6 = subscribeToPackingItems(selectedChildId, setPackingItems)
    return () => { u1(); u2(); u3(); u4(); u5(); u6() }
  }, [selectedChildId])
}
