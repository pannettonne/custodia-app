'use client'

import { useEffect, useState } from 'react'
import { LocationField } from '@/components/events/location/LocationField'

export function GuidedLocationStep2(props: any) {
  const [query, setQuery] = useState(props.locationName || props.locationAddress || '')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [placeId, setPlaceId] = useState('')

  useEffect(() => {
    const text = query.trim()
    if (text.length < 3) {
      setResults([])
      setLoading(false)
      return
    }
    if (placeId && text === (props.locationName || '').trim()) {
      setResults([])
      setLoading(false)
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        setLoading(true)
        const endpoint = ['/api/location-search', '?q='].join('') + encodeURIComponent(text)
        const response = await window.fetch(endpoint, { signal: controller.signal })
        const data = await response.json()
        setResults(Array.isArray(data.results) ? data.results : [])
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [query, props.locationName, placeId])

  const clearLocation = () => {
    setQuery('')
    props.setLocationName('')
    props.setLocationAddress('')
    props.setLocationLatitude(undefined)
    props.setLocationLongitude(undefined)
    props.setLocationPlaceId('')
    setPlaceId('')
    setResults([])
  }

  const selectLocation = (item: any) => {
    setQuery(item.name)
    props.setLocationName(item.name)
    props.setLocationAddress(item.address)
    props.setLocationLatitude(item.latitude)
    props.setLocationLongitude(item.longitude)
    props.setLocationPlaceId(item.placeId)
    setPlaceId(item.placeId)
    setResults([])
  }

  return <LocationField locationQuery={query} setLocationQuery={setQuery} locationName={props.locationName} setLocationName={props.setLocationName} locationAddress={props.locationAddress} setLocationAddress={props.setLocationAddress} setLocationLatitude={props.setLocationLatitude} setLocationLongitude={props.setLocationLongitude} setLocationPlaceId={props.setLocationPlaceId} locationResults={results} locationLoading={loading} clearLocation={clearLocation} selectLocation={selectLocation} />
}
