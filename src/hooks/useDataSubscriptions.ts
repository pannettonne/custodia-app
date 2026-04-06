'use client'

import { useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAppStore } from '@/store/app'
import {
  subscribeToChildren,
  subscribeToPattern,
  subscribeToOverrides,
  subscribeToRequests,
  subscribeToInvitations,
} from '@/lib/db'

export function useDataSubscriptions() {
  const { user } = useAuth()
  const {
    selectedChildId,
    setChildren,
    setPattern,
    setOverrides,
    setRequests,
    setInvitations,
    setSelectedChildId,
    children,
  } = useAppStore()

  // Subscribe to children
  useEffect(() => {
    if (!user) return
    const unsub = subscribeToChildren(user.uid, (kids) => {
      setChildren(kids)
      // Auto-select first child if none selected
      if (kids.length > 0 && !selectedChildId) {
        setSelectedChildId(kids[0].id)
      }
    })
    return unsub
  }, [user?.uid])

  // Subscribe to invitations
  useEffect(() => {
    if (!user?.email) return
    const unsub = subscribeToInvitations(user.email, setInvitations)
    return unsub
  }, [user?.email])

  // Subscribe to selected child data
  useEffect(() => {
    if (!selectedChildId) {
      setPattern(null)
      setOverrides([])
      setRequests([])
      return
    }

    const unsubPattern = subscribeToPattern(selectedChildId, setPattern)
    const unsubOverrides = subscribeToOverrides(selectedChildId, setOverrides)
    const unsubRequests = subscribeToRequests(selectedChildId, setRequests)

    return () => {
      unsubPattern()
      unsubOverrides()
      unsubRequests()
    }
  }, [selectedChildId])
}
