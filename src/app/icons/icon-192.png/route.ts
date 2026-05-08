import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  return NextResponse.redirect(new URL('/nexo-icon.png?v=9', request.url), 308)
}
