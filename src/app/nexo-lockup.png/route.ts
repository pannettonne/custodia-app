import { NextResponse } from 'next/server'

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 180" width="620" height="180">
  <defs>
    <linearGradient id="blue" x1="30" y1="25" x2="185" y2="150" gradientUnits="userSpaceOnUse">
      <stop stop-color="#2563eb"/>
      <stop offset="0.58" stop-color="#0284c7"/>
      <stop offset="1" stop-color="#0f766e"/>
    </linearGradient>
    <linearGradient id="green" x1="210" y1="25" x2="82" y2="155" gradientUnits="userSpaceOnUse">
      <stop stop-color="#10b981"/>
      <stop offset="0.55" stop-color="#84cc16"/>
      <stop offset="1" stop-color="#2dd4bf"/>
    </linearGradient>
    <linearGradient id="cyan" x1="28" y1="132" x2="105" y2="78" gradientUnits="userSpaceOnUse">
      <stop stop-color="#2563eb"/>
      <stop offset="1" stop-color="#38bdf8"/>
    </linearGradient>
    <linearGradient id="tag" x1="462" y1="145" x2="585" y2="145" gradientUnits="userSpaceOnUse">
      <stop stop-color="#0891b2"/>
      <stop offset="1" stop-color="#65a30d"/>
    </linearGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#0f172a" flood-opacity="0.10"/>
    </filter>
  </defs>

  <rect width="620" height="180" fill="none"/>

  <g transform="translate(18 24) scale(.76)" filter="url(#soft)">
    <path d="M70 118C70 62 102 28 144 28C177 28 203 51 232 86" stroke="url(#blue)" stroke-width="48" stroke-linecap="round" fill="none"/>
    <path d="M234 86C263 51 289 28 322 28C364 28 396 62 396 118" stroke="url(#green)" stroke-width="48" stroke-linecap="round" fill="none"/>
    <path d="M70 118L150 38L306 156" stroke="url(#blue)" stroke-width="48" stroke-linecap="round" fill="none" opacity="0.96"/>
    <path d="M396 118L316 38L160 156" stroke="url(#green)" stroke-width="48" stroke-linecap="round" fill="none" opacity="0.92"/>
    <path d="M50 142L142 50" stroke="url(#cyan)" stroke-width="48" stroke-linecap="round" fill="none"/>
    <path d="M416 142L324 50" stroke="url(#green)" stroke-width="48" stroke-linecap="round" fill="none" opacity="0.82"/>
  </g>

  <g transform="translate(196 19)">
    <text x="0" y="87" font-family="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="88" font-weight="900" letter-spacing="-5" fill="#061736">Nexo</text>
    <text x="1" y="139" font-family="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="28" font-weight="500" letter-spacing=".5" fill="#667085">Todo lo importante, </text>
    <text x="322" y="139" font-family="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="28" font-weight="800" letter-spacing=".3" fill="url(#tag)">conectado.</text>
  </g>
</svg>
`

export async function GET() {
  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
