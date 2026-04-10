import { getApps, initializeApp, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'

function normalizePrivateKey(key?: string) {
  return key?.replace(/\\n/g, '\n')
}

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0]
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  const privateKey = normalizePrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY)
  if (!projectId || !clientEmail || !privateKey) throw new Error('Faltan credenciales FIREBASE_ADMIN_*')
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
}

const adminApp = getAdminApp()
export const adminAuth = getAuth(adminApp)
export const adminDb = getFirestore(adminApp)
export const adminMessaging = getMessaging(adminApp)
