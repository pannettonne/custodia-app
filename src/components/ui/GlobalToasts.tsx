'use client'
import { useEffect, useState } from 'react'

type ToastTone = 'success' | 'error' | 'info'

type ToastDetail = {
  message: string
  tone?: ToastTone
}

type ToastItem = {
  id: number
  message: string
  tone: ToastTone
}

const TONE_STYLES: Record<ToastTone, { border: string; background: string; color: string }> = {
  success: { border: 'rgba(16,185,129,0.28)', background: 'linear-gradient(180deg, rgba(16,185,129,0.14) 0%, var(--bg-card) 100%)', color: '#6ee7b7' },
  error: { border: 'rgba(239,68,68,0.28)', background: 'linear-gradient(180deg, rgba(239,68,68,0.14) 0%, var(--bg-card) 100%)', color: '#fca5a5' },
  info: { border: 'rgba(59,130,246,0.28)', background: 'linear-gradient(180deg, rgba(59,130,246,0.14) 0%, var(--bg-card) 100%)', color: '#93c5fd' },
}

export function GlobalToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handler = (event: Event) => {
      const detail = (event as CustomEvent<ToastDetail>).detail
      if (!detail?.message) return
      const id = Date.now() + Math.random()
      const tone = detail.tone ?? 'success'
      setToasts(current => [...current, { id, message: detail.message, tone }])
      window.setTimeout(() => {
        setToasts(current => current.filter(toast => toast.id !== id))
      }, 2600)
    }

    window.addEventListener('custodia:toast', handler as EventListener)
    return () => window.removeEventListener('custodia:toast', handler as EventListener)
  }, [])

  if (toasts.length === 0) return null

  return (
    <div style={{ position:'fixed', top:14, left:14, right:14, zIndex:120, display:'flex', flexDirection:'column', gap:8, pointerEvents:'none' }}>
      {toasts.map(toast => {
        const style = TONE_STYLES[toast.tone]
        return (
          <div key={toast.id} style={{ pointerEvents:'auto', padding:'12px 14px', borderRadius:16, border:`1px solid ${style.border}`, background:style.background, boxShadow:'0 18px 44px rgba(15,23,42,0.24)', color:'var(--text-strong)', backdropFilter:'blur(8px)' }}>
            <div style={{ fontSize:12, fontWeight:800, color:style.color, marginBottom:3 }}>{toast.tone === 'success' ? 'Hecho' : toast.tone === 'error' ? 'Algo ha fallado' : 'Aviso'}</div>
            <div style={{ fontSize:13, color:'var(--text-strong)', lineHeight:1.4 }}>{toast.message}</div>
          </div>
        )}
      )}
    </div>
  )
}
