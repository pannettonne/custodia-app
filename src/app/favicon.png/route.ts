import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const upstream = await fetch(new URL('/nexo-icon.png', request.url), { cache: 'no-store' })
  const bytes = await upstream.arrayBuffer()

  return new NextResponse(bytes, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=0, s-maxage=31536000',
    },
  })
}
