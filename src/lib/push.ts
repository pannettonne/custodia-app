'use client'

import { collection, deleteDoc, getDocs, query, serverTimestamp, addDoc, where } from 'firebase/firestore'
import { deleteToken, getToken, onMessage } from 'firebase/messaging'
import { auth, db, getWebMessaging } from './firebase'

async function getPushServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null
  return navigator.serviceWorker.register('/firebase-messaging-sw.js')
}

async function getCurrentDeviceToken() {
  const messaging = await getWebMessaging()
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
  if (!messaging || !vapidKey) return null
  const sw = await getPushServiceWorker()
  if (!sw) return null
  try {
    return await getToken(messaging, { vapidKey, serviceWorkerRegistration: sw })
  } catch {
    return null
  }
}

export async function isPushAvailable() {
  if (typeof window === 'undefined') return false
  if (!('Notification' in window)) return false
  if (!('serviceWorker' in navigator)) return false
  return !!(await getWebMessaging())
}

export async function enablePushNotifications() {
  const user = auth.currentUser
  if (!user) throw new Error('Debes iniciar sesión')
  const messaging = await getWebMessaging()
  if (!messaging) throw new Error('Este navegador no soporta push web')
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
  if (!vapidKey) throw new Error('Falta NEXT_PUBLIC_FIREBASE_VAPID_KEY')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Permiso de notificaciones denegado')

  const sw = await getPushServiceWorker()
  if (!sw) throw new Error('No se pudo registrar el service worker de push')

  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: sw })
  if (!token) throw new Error('No se pudo obtener el token push')

  const q = query(collection(db, 'pushSubscriptions'), where('uid', '==', user.uid), where('token', '==', token))
  const snap = await getDocs(q)
  if (snap.empty) {
    await addDoc(collection(db, 'pushSubscriptions'), {
      uid: user.uid,
      token,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ua: navigator.userAgent,
    })
  }
  return token
}

export async function disablePushNotifications() {
  const user = auth.currentUser
  const messaging = await getWebMessaging()
  if (!user) return

  const token = await getCurrentDeviceToken()

  try {
    if (token) {
      const q = query(collection(db, 'pushSubscriptions'), where('uid', '==', user.uid), where('token', '==', token))
      const snap = await getDocs(q)
      await Promise.all(snap.docs.map(d => deleteDoc(d.ref)))
    } else {
      const q = query(collection(db, 'pushSubscriptions'), where('uid', '==', user.uid), where('ua', '==', navigator.userAgent))
      const snap = await getDocs(q)
      await Promise.all(snap.docs.map(d => deleteDoc(d.ref)))
    }
  } catch {}

  try {
    if (messaging) await deleteToken(messaging)
  } catch {}

  try {
    const sw = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js')
    const subscription = await sw?.pushManager.getSubscription()
    if (subscription) await subscription.unsubscribe()
  } catch {}
}

export async function getPushStatus() {
  const user = auth.currentUser
  const available = await isPushAvailable()
  if (!user || !available) return { available, enabled: false, permission: typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default' }

  const token = await getCurrentDeviceToken()
  if (!token) return { available: true, enabled: false, permission: Notification.permission }

  const q = query(collection(db, 'pushSubscriptions'), where('uid', '==', user.uid), where('token', '==', token))
  const snap = await getDocs(q)
  return { available: true, enabled: !snap.empty, permission: Notification.permission }
}

export async function sendTestPush() {
  const user = auth.currentUser
  if (!user) throw new Error('Debes iniciar sesión')
  const idToken = await user.getIdToken()
  const res = await fetch('/api/push/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'No se pudo enviar el push de prueba')
  if (!data?.sent) throw new Error('No hay ninguna suscripción push activa en este dispositivo')
  return data
}

export async function attachForegroundPushLogger(onPayload: (payload: any) => void) {
  const messaging = await getWebMessaging()
  if (!messaging) return () => {}
  return onMessage(messaging, onPayload)
}
