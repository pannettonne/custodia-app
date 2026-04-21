import { del } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'

async function requireUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) throw new Error('No autorizado')
  return adminAuth.verifyIdToken(token)
}

export async function POST(request: NextRequest) {
  try {
    await requireUser(request)
    const { pathname } = await request.json()
    if (!pathname || typeof pathname !== 'string') {
      return NextResponse.json({ error: 'Falta pathname del blob' }, { status: 400 })
    }

    await del(pathname, { token: process.env.BLOB_READ_WRITE_TOKEN })
    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error borrando documento cifrado'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
