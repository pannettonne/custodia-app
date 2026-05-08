import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const upstream = await fetch(new URL('/icon.png', request.url), { cache: 'no-store' })
  const bytes = await upstream.arrayBuffer()

  return new NextResponse(bytes, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}
