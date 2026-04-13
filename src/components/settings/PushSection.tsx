'use client'
import { useEffect, useState } from 'react'
import { disablePushNotifications, enablePushNotifications, getPushStatus, sendTestPush } from '@/lib/push'

export function PushSection() {
  const [available, setAvailable] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [permission, setPermission] = useState<string>('default')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const refresh = async () => {
    const status = await getPushStatus()
    setAvailable(status.available)
    setEnabled(status.enabled)
    setPermission(status.permission || 'default')
  }

  useEffect(() => {
    void refresh()
  }, [])

  const handleEnable = async () => {
    setLoading(true)
    setMessage('')
    try {
      await enablePushNotifications()
      await refresh()
      setMessage('Push activado correctamente en este dispositivo.')
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo activar push')
    } finally {
      setLoading(false)
    }
  }

  const handleDisable = async () => {
    setLoading(true)
    setMessage('')
    try {
      await disablePushNotifications()
      await refresh()
      setMessage('Push desactivado en este dispositivo.')
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo desactivar push')
    } finally {
      setLoading(false)
    }
  }

  const handleTest = async () => {
    setLoading(true)
    setMessage('')
    try {
      const result = await sendTestPush()
      setMessage(result?.sent > 0 ? 'Push de prueba enviado. Revisa la notificación del sistema.' : 'No hay ninguna suscripción push activa en este dispositivo.')
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo enviar el push de prueba')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card">
      <div style={{ fontSize: 13, fontWeight: 700, color: '#9ca3af', marginBottom: 12 }}>🔔 Notificaciones push</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
        Estado: <strong style={{ color: 'var(--text-strong)' }}>{!available ? 'No disponible' : enabled ? 'Activadas' : 'Desactivadas'}</strong>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
        Permiso del navegador: <strong style={{ color: 'var(--text-secondary)' }}>{permission}</strong>
      </div>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        {!enabled ? <button onClick={handleEnable} disabled={loading || !available} style={{ padding:'10px 12px', borderRadius:12, border:'none', background:loading || !available ? 'rgba(255,255,255,0.08)' : '#3B82F6', color:loading || !available ? '#6b7280' : '#fff', fontSize:12, fontWeight:700, cursor:loading || !available ? 'not-allowed' : 'pointer' }}>Activar push</button> : <button onClick={handleDisable} disabled={loading} style={{ padding:'10px 12px', borderRadius:12, border:'1px solid rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.12)', color:'#fca5a5', fontSize:12, fontWeight:700, cursor:loading ? 'not-allowed' : 'pointer' }}>Desactivar push</button>}
        <button onClick={handleTest} disabled={loading || !enabled} style={{ padding:'10px 12px', borderRadius:12, border:'1px solid var(--border)', background:'var(--bg-soft)', color:loading || !enabled ? '#6b7280' : 'var(--text-secondary)', fontSize:12, fontWeight:700, cursor:loading || !enabled ? 'not-allowed' : 'pointer' }}>Probar push</button>
      </div>
      <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:8 }}>
        En iPhone funciona en la PWA instalada en pantalla de inicio.
      </div>
      {message && <div style={{ marginTop:10, fontSize:12, color: message.includes('correctamente') || message.includes('enviado') || message.includes('Desactivado') ? '#86efac' : '#fca5a5' }}>{message}</div>}
    </div>
  )
}
