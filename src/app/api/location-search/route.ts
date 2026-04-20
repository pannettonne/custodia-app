import { NextRequest, NextResponse } from 'next/server'

type NominatimItem = {
  place_id: number
  display_name: string
  lat: string
  lon: string
  name?: string
  address?: {
    road?: string
    house_number?: string
    city?: string
    town?: string
    village?: string
    state?: string
    country?: string
  }
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim() || ''

  if (query.length < 3) {
    return NextResponse.json({ results: [] })
  }

  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', query)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('limit', '5')
  url.searchParams.set('countrycodes', 'es,pt,fr,it')

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'CustodiaApp/1.0',
        Accept: 'application/json',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      return NextResponse.json({ results: [] })
    }

    const data = (await response.json()) as NominatimItem[]

    const results = data.map(item => ({
      placeId: String(item.place_id),
      name:
        item.name ||
        item.address?.road ||
        item.display_name.split(',')[0] ||
        'Ubicación',
      address: item.display_name,
      latitude: Number(item.lat),
      longitude: Number(item.lon),
    }))

    return NextResponse.json({ results })
  } catch {
    return NextResponse.json({ results: [] })
  }
}
