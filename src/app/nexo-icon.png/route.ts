'use server'

import { NextResponse } from 'next/server'

const ICON_BASE64 = '__PLACEHOLDER__'

export async function GET() {
  const bytes = Buffer.from(ICON_BASE64, 'base64')
  return new NextResponse(bytes, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
