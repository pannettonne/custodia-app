import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const decoded = await adminAuth.verifyIdToken(token)

    const res = await fetch(new URL('/api/push/dispatch', request.url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        userIds: [decoded.uid],
        title: 'Push de prueba',
        body: 'Si ves esto, las notificaciones push ya funcionan en tu dispositivo.',
      }),
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error enviando push de prueba' }, { status: 500 })
  }
}
