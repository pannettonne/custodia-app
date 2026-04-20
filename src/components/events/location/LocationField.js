'use client'

export function LocationField({
  locationQuery,
  setLocationQuery,
  locationName,
  setLocationName,
  locationAddress,
  setLocationAddress,
  setLocationLatitude,
  setLocationLongitude,
  setLocationPlaceId,
  locationResults,
  locationLoading,
  clearLocation,
  selectLocation,
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="settings-label">Ubicación (opcional)</div>
      <input
        value={locationQuery}
        onChange={e => {
          const next = e.target.value
          setLocationQuery(next)
          if (!next.trim()) {
            clearLocation()
            return
          }
          setLocationName(next)
          setLocationAddress('')
          setLocationLatitude(undefined)
          setLocationLongitude(undefined)
          setLocationPlaceId('')
        }}
        placeholder="Busca una dirección, colegio, clínica..."
        className="settings-input"
      />

      {locationLoading && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
          Buscando ubicaciones...
        </div>
      )}

      {locationResults.length > 0 && (
        <div
          style={{
            marginTop: 8,
            border: '1px solid var(--border)',
            borderRadius: 12,
            overflow: 'hidden',
            background: 'var(--bg-card)',
          }}
        >
          {locationResults.map(item => (
            <button
              key={item.placeId}
              type="button"
              onClick={() => selectLocation(item)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: 'none',
                borderBottom: '1px solid var(--border)',
                background: 'transparent',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-strong)' }}>
                {item.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.address}</div>
            </button>
          ))}
        </div>
      )}

      {(locationName || locationAddress) && (
        <div
          style={{
            marginTop: 8,
            padding: '10px 12px',
            borderRadius: 12,
            background: 'var(--bg-soft)',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-strong)' }}>
            📍 {locationName || 'Ubicación seleccionada'}
          </div>
          {locationAddress && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              {locationAddress}
            </div>
          )}
          <button
            type="button"
            onClick={clearLocation}
            style={{
              marginTop: 8,
              background: 'rgba(239,68,68,0.10)',
              border: '1px solid rgba(239,68,68,0.18)',
              color: '#fca5a5',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 800,
              padding: '6px 9px',
              borderRadius: 10,
            }}
          >
            Quitar ubicación
          </button>
        </div>
      )}
    </div>
  )
}
