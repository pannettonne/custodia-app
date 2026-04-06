'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  setPersistence,
  browserLocalPersistence,
  type User as FirebaseUser,
} from 'firebase/auth'
import { auth, googleProvider } from '@/lib/firebase'

interface AuthContextType {
  user: FirebaseUser | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

function isSafariOrIOS(): boolean {
  if (typeof window === 'undefined') return false
  const ua = navigator.userAgent
  const isIOS = /iPhone|iPad|iPod/i.test(ua)
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua)
  return isIOS || isSafari
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubscribe: (() => void) | undefined

    const initAuth = async () => {
      try {
        await setPersistence(auth, browserLocalPersistence)
      } catch {
        // Ignore persistence errors and continue with auth resolution
      }

      try {
        await getRedirectResult(auth)
      } catch {
        // No pending redirect or redirect result unavailable
      }

      unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        setUser(firebaseUser)
        setLoading(false)
      })
    }

    initAuth()

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])

  const signInWithGoogle = async () => {
    try {
      await setPersistence(auth, browserLocalPersistence)
    } catch {
      // Continue even if Safari/iOS limits persistence setup
    }

    if (isSafariOrIOS()) {
      await signInWithRedirect(auth, googleProvider)
      return
    }

    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err: any) {
      if (err.code === 'auth/popup-blocked' || err.code === 'auth/popup-closed-by-user') {
        await signInWithRedirect(auth, googleProvider)
      } else {
        throw err
      }
    }
  }

  const signOut = async () => {
    await firebaseSignOut(auth)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
