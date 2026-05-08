import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const upstream = await fetch(new URL('/nexo-icon.png?v=10', request.url), { cache: 'force-cache' })
  const bytes = await upstream.arrayBuffer()

  return new NextResponse(bytes, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
