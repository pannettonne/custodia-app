'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
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

// Detect if running in Safari / WebKit (iOS, iPadOS, macOS Safari)
function isSafari(): boolean {
  if (typeof window === 'undefined') return false
  const ua = navigator.userAgent
  return /^((?!chrome|android).)*safari/i.test(ua) || /iPhone|iPad|iPod/i.test(ua)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubscribe: (() => void) | null = null

    async function init() {
      try {
        // Check for pending redirect result (after iOS/Safari redirect flow)
        const result = await getRedirectResult(auth)
        if (result?.user) {
          setUser(result.user)
          setLoading(false)
        }
      } catch {
        // No pending redirect - this is normal
      }

      // Always set up the auth state listener
      unsubscribe = onAuthStateChanged(auth, (u) => {
        setUser(u)
        setLoading(false)
      })
    }

    init()
    return () => { if (unsubscribe) unsubscribe() }
  }, [])

  const signInWithGoogle = async () => {
    if (isSafari()) {
      // Safari blocks popups → use redirect
      await signInWithRedirect(auth, googleProvider)
    } else {
      try {
        await signInWithPopup(auth, googleProvider)
      } catch (err: any) {
        // Fallback to redirect if popup fails for any reason
        if (err.code === 'auth/popup-blocked' || err.code === 'auth/popup-closed-by-user') {
          await signInWithRedirect(auth, googleProvider)
        } else {
          throw err
        }
      }
    }
  }

  const signOut = async () => { await firebaseSignOut(auth) }

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
