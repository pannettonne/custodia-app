'use client'

import { collection, deleteDoc, getDocs, query, serverTimestamp, addDoc, where } from 'firebase/firestore'
import { deleteToken, getToken, onMessage } from 'firebase/messaging'
import { auth, db, getWebMessaging } from './firebase'

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

  const sw = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: sw })
  if (!token) throw new Error('No se pudo obtener el token push')

  const q = query(collection(db, 'pushSubscriptions'), where('uid', '==', user.uid), where('token', '==', token))
  const snap = await getDocs(q)
  if (snap.empty) {
    await addDoc(collection(db, 'pushSubscriptions'), { uid: user.uid, token, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ua: navigator.userAgent })
  }
  return token
}

export async function disablePushNotifications() {
  const user = auth.currentUser
  const messaging = await getWebMessaging()
  if (!user || !messaging) return
  try {
    const sw = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js')
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
    const token = vapidKey ? await getToken(messaging, { vapidKey, serviceWorkerRegistration: sw || undefined }) : null
    if (token) {
      const q = query(collection(db, 'pushSubscriptions'), where('uid', '==', user.uid), where('token', '==', token))
      const snap = await getDocs(q)
      await Promise.all(snap.docs.map(d => deleteDoc(d.ref)))
      await deleteToken(messaging)
    }
  } catch {}
}

export async function getPushStatus() {
  const user = auth.currentUser
  const available = await isPushAvailable()
  if (!user || !available) return { available, enabled: false }
  const q = query(collection(db, 'pushSubscriptions'), where('uid', '==', user.uid))
  const snap = await getDocs(q)
  return { available: true, enabled: !snap.empty }
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
  return data
}

export async function attachForegroundPushLogger(onPayload: (payload: any) => void) {
  const messaging = await getWebMessaging()
  if (!messaging) return () => {}
  return onMessage(messaging, onPayload)
}
