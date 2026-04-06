'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { LoginPage } from '@/components/ui/LoginPage'
import { AppShell } from '@/components/ui/AppShell'

export default function Home() {
  const { user, loading } = useAuth()
  const [firebaseOk, setFirebaseOk] = useState<string>('checking')

  useEffect(() => {
    // Test Firebase connection on mount
    import('@/lib/firebase').then(({ db, auth }) => {
      try {
        const projectId = (db as any)?._databaseId?.projectId ?? 'unknown'
        const authOk = !!auth?.app
        setFirebaseOk(`db:${projectId} auth:${authOk}`)
      } catch (e: any) {
        setFirebaseOk(`error: ${e.message}`)
      }
    })
  }, [])

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', background: '#0d1117', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <div style={{ fontSize: 48 }}>👨‍👩‍👦</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#3B82F6', animation: 'bounce 0.6s infinite', animationDelay: `${i*0.15}s` }} />
          ))}
        </div>
        <div style={{ fontSize: 11, color: '#4b5563' }}>Firebase: {firebaseOk}</div>
        <style>{`@keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }`}</style>
      </div>
    )
  }

  if (!user) return <LoginPage />
  return <AppShell />
}
