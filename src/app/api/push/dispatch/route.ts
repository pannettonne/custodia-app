import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb, adminMessaging } from '@/lib/firebase-admin'

async function requireUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) throw new Error('No autorizado')
  return adminAuth.verifyIdToken(token)
}

function buildLink({ childId, targetTab, targetDate }: { childId?: string; targetTab?: string; targetDate?: string }) {
  const params = new URLSearchParams()
  if (targetTab) params.set('tab', targetTab)
  if (childId) params.set('childId', childId)
  if (targetDate) params.set('date', targetDate)
  const qs = params.toString()
  return qs ? `/?${qs}` : '/'
}

export async function POST(request: NextRequest) {
  try {
    await requireUser(request)
    const { userIds, title, body, childId, targetTab, targetDate } = await request.json()
    const ids = Array.isArray(userIds) ? userIds.filter(Boolean) : []
    if (ids.length === 0) return NextResponse.json({ error: 'Faltan destinatarios' }, { status: 400 })

    const tokenSnaps = await Promise.all(ids.map(uid => adminDb.collection('pushSubscriptions').where('uid', '==', uid).get()))
    const tokens = tokenSnaps.flatMap(s => s.docs.map(d => d.get('token')).filter(Boolean))
    if (tokens.length === 0) return NextResponse.json({ ok: true, sent: 0 })

    const link = buildLink({ childId, targetTab, targetDate })
    const res = await adminMessaging.sendEachForMulticast({
      tokens,
      notification: { title: title || 'CustodiaApp', body: body || '' },
      webpush: {
        notification: {
          title: title || 'CustodiaApp',
          body: body || '',
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          data: { ...(childId ? { childId } : {}), ...(targetTab ? { targetTab } : {}), ...(targetDate ? { targetDate } : {}) },
        },
        fcmOptions: { link },
      },
    })

    return NextResponse.json({ ok: true, sent: res.successCount, failed: res.failureCount, link })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error enviando push' }, { status: 500 })
  }
}
