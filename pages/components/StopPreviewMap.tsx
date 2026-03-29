import { useEffect, useRef } from 'react'
import { Button } from 'antd-mobile'
import type { Map as MapLibreMap, Marker } from 'maplibre-gl'
import { useAppSettings } from '../../lib/app-settings'
import { getBaseMapStyle } from '../../lib/mapStyle'
import { getThemeColor } from '../../lib/theme'
import type { Nullable, StopCandidate } from '../../lib/types'

interface StopPreviewMapProps {
  stop?: Nullable<StopCandidate>
  previewLabel?: string
  routeMapLabel?: string
  googleMapsLabel?: string
}

export default function StopPreviewMap({
  stop = null,
  previewLabel = 'Stop location preview',
  routeMapLabel = 'Route map',
  googleMapsLabel = 'Open in Google Maps',
}: StopPreviewMapProps) {
  const { isDark } = useAppSettings()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<Nullable<MapLibreMap>>(null)
  const markerRef = useRef<Nullable<Marker>>(null)
  const stopId = stop?.id
  const stopLat = stop?.lat
  const stopLng = stop?.lng
  const stopLocationHref = stop
    ? `https://www.google.com/maps/search/?api=1&query=${stop.lat},${stop.lng}`
    : null
  const routeMapHref = stop?.google_maps_url ?? stopLocationHref

  useEffect(() => {
    if (!containerRef.current || !stop || mapRef.current) return

    let disposed = false

    void import('maplibre-gl').then(({ default: maplibregl }) => {
      if (disposed || !containerRef.current || !stop) return

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: getBaseMapStyle(isDark),
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
        const marker = new maplibregl.Marker({
          color: getThemeColor('--app-map-marker-primary'),
          scale: 1.15,
        })
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
  }, [isDark, stop, stopId, stopLat, stopLng])

  useEffect(() => {
    if (!mapRef.current || !stop) return
    mapRef.current.jumpTo({ center: [stop.lng, stop.lat], zoom: 15 })
    markerRef.current?.setLngLat([stop.lng, stop.lat])
  }, [stop, stopId, stopLat, stopLng])

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
        <div
          ref={containerRef}
          style={{
            width: '100%',
            height: 220,
            background: 'var(--app-color-surface-muted)',
          }}
        />
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
              if (routeMapHref) window.open(routeMapHref, '_blank', 'noopener,noreferrer')
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
              if (stopLocationHref) window.open(stopLocationHref, '_blank', 'noopener,noreferrer')
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
