import { useEffect, useRef } from 'react'
import { Button } from 'antd-mobile'
import type { Marker } from 'maplibre-gl'
import { useMapLibre } from '../../hooks/useMapLibre'
import { getThemeColor } from '../../lib/theme'
import type { Nullable, StopCandidate } from '../../lib/types'

interface StopPreviewMapProps {
  stop?: Nullable<StopCandidate>
  previewLabel?: string
  routeMapLabel?: string
  googleMapsLabel?: string
}

const DEFAULT_CENTER: [number, number] = [103.8198, 1.3521]

export default function StopPreviewMap({
  stop = null,
  previewLabel = 'Stop location preview',
  routeMapLabel = 'Route map',
  googleMapsLabel = 'Open in Google Maps',
}: StopPreviewMapProps) {
  const markerRef = useRef<Nullable<Marker>>(null)
  const stopLocationHref = stop
    ? `https://www.google.com/maps/search/?api=1&query=${stop.lat},${stop.lng}`
    : null
  const routeMapHref = stop?.google_maps_url ?? stopLocationHref
  const { containerRef, mapRef, mapLibRef, mapReady } = useMapLibre({
    center: stop ? [stop.lng, stop.lat] : DEFAULT_CENTER,
    zoom: 15,
    mapOptions: {
      dragPan: false,
      scrollZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      dragRotate: false,
      keyboard: false,
      touchZoomRotate: false,
    },
  })

  useEffect(() => {
    if (!mapReady || !mapRef.current || !mapLibRef.current || !stop) {
      return
    }

    const map = mapRef.current
    const maplibregl = mapLibRef.current

    if (!markerRef.current) {
      markerRef.current = new maplibregl.Marker({
        color: getThemeColor('--app-map-marker-primary'),
        scale: 1.15,
      })
        .setLngLat([stop.lng, stop.lat])
        .addTo(map)
    } else {
      markerRef.current.setLngLat([stop.lng, stop.lat])
    }

    map.jumpTo({ center: [stop.lng, stop.lat], zoom: 15 })
  }, [mapReady, mapLibRef, mapRef, stop])

  useEffect(() => {
    return () => {
      markerRef.current?.remove()
      markerRef.current = null
    }
  }, [])

  return (
    <div style={{ padding: 16, paddingBottom: 8 }}>
      <div
        style={{
          marginBottom: 10,
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--app-color-subtle-text)',
        }}
      >
        {previewLabel}
      </div>
      <div
        style={{
          overflow: 'hidden',
          borderRadius: 18,
          background: 'var(--app-color-surface)',
          boxShadow: 'var(--app-shadow-raised)',
        }}
      >
        <div ref={containerRef} style={{ width: '100%', height: 220 }} />
        <div
          style={{
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap',
            padding: '12px 14px',
            background: 'var(--adm-color-background)',
            borderTop: '1px solid var(--app-color-border)',
          }}
        >
          <Button
            fill='none'
            size='small'
            onClick={() => {
              if (routeMapHref) {
                window.open(routeMapHref, '_blank', 'noopener,noreferrer')
              }
            }}
            style={{
              padding: 0,
              color: 'var(--app-color-link)',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {routeMapLabel}
          </Button>
          <Button
            fill='none'
            size='small'
            onClick={() => {
              if (stopLocationHref) {
                window.open(stopLocationHref, '_blank', 'noopener,noreferrer')
              }
            }}
            style={{
              padding: 0,
              color: 'var(--app-color-link)',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {googleMapsLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
