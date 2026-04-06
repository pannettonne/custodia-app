'use client'

import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
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

function isMobile(): boolean {
  if (typeof window === 'undefined') return false
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [loading, setLoading] = useState(true)
  const redirectHandled = useRef(false)

  useEffect(() => {
    // First set up the auth state listener
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })

    // Then handle any pending redirect result (iOS/Android flow)
    // Only run once, guard with ref to avoid loops
    if (!redirectHandled.current) {
      redirectHandled.current = true
      getRedirectResult(auth)
        .then((result) => {
          if (result?.user) {
            setUser(result.user)
            setLoading(false)
          }
        })
        .catch(() => {
          // No pending redirect or error — perfectly normal
        })
    }

    return unsub
  }, [])

  const signInWithGoogle = async () => {
    if (isMobile()) {
      // iOS Safari: redirect flow avoids popup/sessionStorage issues
      await signInWithRedirect(auth, googleProvider)
    } else {
      await signInWithPopup(auth, googleProvider)
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
