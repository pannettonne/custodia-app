import { put } from '@vercel/blob'
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
    const user = await requireUser(request)
    const formData = await request.formData()
    const file = formData.get('file')
    const childId = String(formData.get('childId') || '')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Falta el fichero cifrado' }, { status: 400 })
    }

    const sanitizedChildId = childId || 'shared'
    const pathname = `documents/${sanitizedChildId}/${user.uid}-${Date.now()}-${file.name}`
    const blob = await put(pathname, file, {
      access: 'public',
      addRandomSuffix: false,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })

    return NextResponse.json({ ok: true, url: blob.url, pathname: blob.pathname })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error subiendo documento cifrado'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
