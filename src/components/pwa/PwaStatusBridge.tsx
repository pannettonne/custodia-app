'use client'

import { useEffect, useMemo, useState } from 'react'

const APP_VERSION = '2026.05.07.1'
const CHECK_INTERVAL_MS = 5 * 60 * 1000

const WRITE_WORDS = [
  'crear',
  'guardar',
  'añadir',
  'agregar',
  'nuevo',
  'nueva',
  'editar',
  'eliminar',
  'borrar',
  'aceptar',
  'rechazar',
  'cancelar solicitud',
  'solicitar',
  'confirmar',
  'administrada',
  'marcar',
  'omitir',
  'asignar',
  'invitar',
]

const SAFE_WORDS = ['volver', 'cerrar', 'mostrar', 'ocultar', 'más', 'hoy', 'calendario', 'cambios', 'eventos']

function isProbablyWriteButton(button: HTMLButtonElement) {
  if (button.closest('.bottom-nav')) return false
  if (button.closest('.more-real-grid')) return false
  if (button.closest('.calendar-view-toggle')) return false
  if (button.getAttribute('aria-label')?.toLowerCase().includes('cerrar')) return false
  if (button.type === 'submit') return true
  if (button.className.toString().includes('req-action-btn')) return true
  if (button.className.toString().includes('btn-primary')) return true

  const text = (button.textContent || '').trim().toLowerCase()
  if (!text) return false
  if (SAFE_WORDS.some(word => text === word || text.startsWith(`${word} `))) return false
  return WRITE_WORDS.some(word => text.includes(word))
}

function showOfflineNotice() {
  window.dispatchEvent(new CustomEvent('custodia:pwa-notice', { detail: { message: 'Sin conexión. Puedes consultar datos, pero no modificar.' } }))
}

async function clearAppCaches() {
  if ('caches' in window) {
    const keys = await caches.keys()
    await Promise.all(keys.map(key => caches.delete(key)))
  }

  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map(async registration => {
      try {
        await registration.update()
        registration.waiting?.postMessage({ type: 'SKIP_WAITING' })
      } catch {}
    }))
  }
}

export function PwaStatusBridge() {
  const [online, setOnline] = useState(true)
  const [latestVersion, setLatestVersion] = useState<string | null>(null)
  const [checkingVersion, setCheckingVersion] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)

  const updateAvailable = useMemo(() => !!latestVersion && latestVersion !== APP_VERSION, [latestVersion])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const sync = () => setOnline(navigator.onLine)
    sync()
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    return () => {
      window.removeEventListener('online', sync)
      window.removeEventListener('offline', sync)
    }
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.body.classList.toggle('custodia-offline', !online)
    return () => document.body.classList.remove('custodia-offline')
  }, [online])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail
      setNotice(detail?.message || 'Sin conexión. Puedes consultar datos, pero no modificar.')
      window.setTimeout(() => setNotice(null), 2800)
    }
    window.addEventListener('custodia:pwa-notice', handler)
    return () => window.removeEventListener('custodia:pwa-notice', handler)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const blockClick = (event: MouseEvent) => {
      if (online) return
      const target = event.target
      if (!(target instanceof Element)) return
      const button = target.closest<HTMLButtonElement>('button')
      if (!button || !isProbablyWriteButton(button)) return
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      showOfflineNotice()
    }

    const blockSubmit = (event: Event) => {
      if (online) return
      event.preventDefault()
      event.stopPropagation()
      showOfflineNotice()
    }

    window.addEventListener('click', blockClick, { capture: true })
    window.addEventListener('submit', blockSubmit, { capture: true })
    return () => {
      window.removeEventListener('click', blockClick, { capture: true } as any)
      window.removeEventListener('submit', blockSubmit, { capture: true } as any)
    }
  }, [online])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const checkVersion = async () => {
      if (!navigator.onLine || checkingVersion) return
      setCheckingVersion(true)
      try {
        const response = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
        if (!response.ok) return
        const data = await response.json()
        if (typeof data?.version === 'string') setLatestVersion(data.version)
      } catch {
        // Version checks should never break app usage.
      } finally {
        setCheckingVersion(false)
      }
    }

    checkVersion()
    const timer = window.setInterval(checkVersion, CHECK_INTERVAL_MS)
    window.addEventListener('online', checkVersion)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('online', checkVersion)
    }
  }, [checkingVersion])

  const updateNow = async () => {
    setUpdating(true)
    try {
      await clearAppCaches()
    } finally {
      window.location.reload()
    }
  }

  return (
    <>
      {(!online || updateAvailable) ? (
        <div className="pwa-status-stack" aria-live="polite">
          {!online ? (
            <div className="pwa-status-banner offline">
              <div>
                <div className="pwa-status-title">Sin conexión</div>
                <div className="pwa-status-copy">Mostrando últimos datos guardados. Las modificaciones están bloqueadas.</div>
              </div>
            </div>
          ) : null}

          {updateAvailable ? (
            <div className="pwa-status-banner update">
              <div>
                <div className="pwa-status-title">Nueva versión disponible</div>
                <div className="pwa-status-copy">Actualiza para cargar las últimas mejoras.</div>
              </div>
              <button type="button" className="pwa-update-button" onClick={updateNow} disabled={updating || !online}>
                {updating ? 'Actualizando…' : 'Actualizar'}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {notice ? <div className="pwa-offline-toast">{notice}</div> : null}
    </>
  )
}
