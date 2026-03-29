import { useEffect, useRef } from 'react'
import type { LngLatBoundsLike, Marker } from 'maplibre-gl'
import { useMapLibre } from '../../hooks/useMapLibre'
import { getThemeColor } from '../../lib/theme'
import type { Station } from '../../lib/types'
import MapControls from './MapControls'

const DEFAULT_CENTER: [number, number] = [103.8198, 1.3521]
const DEFAULT_ZOOM = 11
const CURRENT_LOCATION_ZOOM = 15

interface StationBrowserMapProps {
  stations?: Station[]
  onSelect?: (stationId: string) => void
  zoomInAriaLabel?: string
  zoomOutAriaLabel?: string
  currentLocationAriaLabel?: string
  currentLocationUnavailable?: string
}

export default function StationBrowserMap({
  stations = [],
  onSelect,
  zoomInAriaLabel = 'Zoom in',
  zoomOutAriaLabel = 'Zoom out',
  currentLocationAriaLabel = 'Move to my current location',
  currentLocationUnavailable = 'Unable to access your location.',
}: StationBrowserMapProps) {
  const markersRef = useRef<Marker[]>([])
  const { containerRef, mapRef, mapLibRef, mapReady, locating, moveToCurrentLocation } = useMapLibre({
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
    currentLocationZoom: CURRENT_LOCATION_ZOOM,
    currentLocationUnavailable,
  })

  useEffect(() => {
    if (!mapReady || !mapRef.current || !mapLibRef.current) {
      return
    }

    const map = mapRef.current
    const maplibregl = mapLibRef.current

    markersRef.current.forEach(marker => marker.remove())
    markersRef.current = []

    if (stations.length === 0) {
      map.jumpTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM })
      return
    }

    const markerColor = getThemeColor('--app-map-marker-primary')
    const bounds = new maplibregl.LngLatBounds()

    for (const station of stations) {
      const marker = new maplibregl.Marker({ color: markerColor, scale: 0.95 })
        .setLngLat([station.lng, station.lat])
        .setPopup(new maplibregl.Popup({ offset: 18 }).setText(station.name))
        .addTo(map)

      const markerElement = marker.getElement()
      markerElement.style.cursor = 'pointer'
      markerElement.addEventListener('click', () => {
        onSelect?.(station.id)
      })

      markersRef.current.push(marker)
      bounds.extend([station.lng, station.lat])
    }

    if (stations.length === 1) {
      map.flyTo({ center: [stations[0].lng, stations[0].lat], zoom: 14 })
      return
    }

    map.fitBounds(bounds as LngLatBoundsLike, {
      padding: 44,
      maxZoom: 14,
      duration: 0,
    })
  }, [mapReady, mapLibRef, mapRef, onSelect, stations])

  useEffect(() => {
    return () => {
      markersRef.current.forEach(marker => marker.remove())
      markersRef.current = []
    }
  }, [])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <MapControls
        locating={locating}
        onZoomIn={() => {
          mapRef.current?.zoomIn()
        }}
        onZoomOut={() => {
          mapRef.current?.zoomOut()
        }}
        onCurrentLocation={moveToCurrentLocation}
        zoomInAriaLabel={zoomInAriaLabel}
        zoomOutAriaLabel={zoomOutAriaLabel}
        currentLocationAriaLabel={currentLocationAriaLabel}
      />
    </div>
  )
}
