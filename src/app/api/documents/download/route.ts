import { get } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase-admin'

async function requireUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) throw new Error('No autorizado')
  return adminAuth.verifyIdToken(token)
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request)
    const documentId = request.nextUrl.searchParams.get('documentId')
    if (!documentId) {
      return NextResponse.json({ error: 'Falta documentId' }, { status: 400 })
    }

    const documentSnap = await adminDb.collection('documents').doc(documentId).get()
    if (!documentSnap.exists) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
    }

    const documentData = documentSnap.data() as { childId?: string; blobPath?: string; mimeType?: string }
    if (!documentData.childId || !documentData.blobPath) {
      return NextResponse.json({ error: 'Documento incompleto' }, { status: 400 })
    }

    const childSnap = await adminDb.collection('children').doc(documentData.childId).get()
    const childData = childSnap.data() as { parents?: string[] } | undefined
    const parentIds = Array.isArray(childData?.parents) ? childData?.parents : []

    if (!parentIds.includes(user.uid)) {
      return NextResponse.json({ error: 'No tienes acceso a este documento' }, { status: 403 })
    }

    const result = await get(documentData.blobPath, {
      access: 'private',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })

    if (!result || result.statusCode !== 200 || !result.stream) {
      return new NextResponse('Not found', { status: 404 })
    }

    return new NextResponse(result.stream, {
      headers: {
        'Content-Type': documentData.mimeType || result.blob.contentType || 'application/octet-stream',
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudo descargar el documento'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
