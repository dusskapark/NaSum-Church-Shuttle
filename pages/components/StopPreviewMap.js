import { useEffect, useRef } from 'react'

export default function StopPreviewMap({
  stop = null,
  previewLabel = 'Stop location preview',
  routeMapLabel = 'Route map',
  googleMapsLabel = 'Open in Google Maps',
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const stopId = stop?.id
  const stopLat = stop?.lat
  const stopLng = stop?.lng
  const stopLocationHref = stop
    ? `https://www.google.com/maps/search/?api=1&query=${stop.lat},${stop.lng}`
    : null
  const routeMapHref = stop?.google_maps_url || stopLocationHref

  useEffect(() => {
    if (!containerRef.current || !stop || mapRef.current) return

    let disposed = false

    import('maplibre-gl').then(({ default: maplibregl }) => {
      if (disposed || !containerRef.current || !stop) return

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center: [stop.lng, stop.lat],
        zoom: 15,
        attributionControl: false,
        dragPan: false,
        scrollZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        dragRotate: false,
        keyboard: false,
        touchZoomRotate: false,
      })

      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')

      map.on('load', () => {
        const marker = new maplibregl.Marker({ color: '#1677ff', scale: 1.15 })
          .setLngLat([stop.lng, stop.lat])
          .addTo(map)

        markerRef.current = marker
      })

      mapRef.current = map
    })

    return () => {
      disposed = true
      markerRef.current?.remove()
      markerRef.current = null
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [stop, stopId, stopLat, stopLng])

  useEffect(() => {
    if (!mapRef.current || !stop) return
    mapRef.current.jumpTo({ center: [stop.lng, stop.lat], zoom: 15 })
    markerRef.current?.setLngLat([stop.lng, stop.lat])
  }, [stop, stopId, stopLat, stopLng])

  return (
    <div style={{ padding: 16, paddingBottom: 8 }}>
      <div style={{ marginBottom: 10, fontSize: 13, fontWeight: 600, color: '#6b7280' }}>
        {previewLabel}
      </div>
      <div
        style={{
          overflow: 'hidden',
          borderRadius: 18,
          background: '#f3f4f6',
          boxShadow: '0 12px 28px rgba(15, 23, 42, 0.08)',
        }}
      >
        <div ref={containerRef} style={{ width: '100%', height: 220 }} />
        <div
          style={{
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap',
            padding: '12px 14px',
            background: '#fff',
            borderTop: '1px solid #f3f4f6',
          }}
        >
          <span
            role='button'
            tabIndex={0}
            style={{ color: '#1677ff', fontSize: 13, fontWeight: 500 }}
            onClick={() => {
              if (routeMapHref) window.open(routeMapHref, '_blank', 'noopener,noreferrer')
            }}
            onKeyDown={(event) => {
              if ((event.key === 'Enter' || event.key === ' ') && routeMapHref) {
                event.preventDefault()
                window.open(routeMapHref, '_blank', 'noopener,noreferrer')
              }
            }}
          >
            {routeMapLabel}
          </span>
          <span
            role='button'
            tabIndex={0}
            style={{ color: '#1677ff', fontSize: 13, fontWeight: 500 }}
            onClick={() => {
              if (stopLocationHref) window.open(stopLocationHref, '_blank', 'noopener,noreferrer')
            }}
            onKeyDown={(event) => {
              if ((event.key === 'Enter' || event.key === ' ') && stopLocationHref) {
                event.preventDefault()
                window.open(stopLocationHref, '_blank', 'noopener,noreferrer')
              }
            }}
          >
            {googleMapsLabel}
          </span>
        </div>
      </div>
    </div>
  )
}
