'use client'

import { useAuth } from '@/lib/auth-context'
import { LoginPage } from '@/components/ui/LoginPage'
import { AppShellRealTabs } from '@/components/ui/AppShellRealTabs'
import { GlobalSearchBridge } from '@/components/ui/GlobalSearchBridge'

export default function Home() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="startup-splash">
        <div className="startup-splash-card">
          <img src="/apple-touch-icon.png?v=4" alt="CustodiaApp" className="startup-splash-logo" />
          <div className="startup-splash-kicker">Familia organizada</div>
          <div className="startup-splash-title">CustodiaApp</div>
          <div className="startup-splash-subtitle">Preparando tu calendario familiar</div>
          <div className="startup-splash-loader" aria-label="Cargando">
            {[0, 1, 2].map(i => <span key={i} style={{ animationDelay: `${i * 0.16}s` }} />)}
          </div>
        </div>
      </div>
    )
  }

  if (!user) return <LoginPage />
  return (
    <>
      <AppShellRealTabs />
      <GlobalSearchBridge />
    </>
  )
}
