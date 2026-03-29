import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Toast } from 'antd-mobile'
import { AddOutline, MinusOutline, TravelOutline } from 'antd-mobile-icons'
import type { LngLatBoundsLike, Map as MapLibreMap, Marker } from 'maplibre-gl'
import { useAppSettings } from '../../lib/app-settings'
import { getBaseMapStyle } from '../../lib/mapStyle'
import { getThemeColor } from '../../lib/theme'
import type { Station } from '../../lib/types'

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
  const { isDark } = useAppSettings()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const mapLibRef = useRef<(typeof import('maplibre-gl')) | null>(null)
  const markersRef = useRef<Marker[]>([])
  const currentLocationMarkerRef = useRef<Marker | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [locating, setLocating] = useState(false)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    let disposed = false

    void import('maplibre-gl').then(({ default: maplibregl }) => {
      if (disposed || !containerRef.current) return

      mapLibRef.current = maplibregl
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: getBaseMapStyle(isDark),
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        attributionControl: false,
      })

      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
      map.on('load', () => {
        setMapReady(true)
      })
      mapRef.current = map
    })

    return () => {
      disposed = true
      for (const marker of markersRef.current) marker.remove()
      markersRef.current = []
      currentLocationMarkerRef.current?.remove()
      currentLocationMarkerRef.current = null
      mapRef.current?.remove()
      mapRef.current = null
      mapLibRef.current = null
      setMapReady(false)
    }
  }, [isDark])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    for (const marker of markersRef.current) marker.remove()
    markersRef.current = []

    if (stations.length === 0) {
      map.jumpTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM })
      return
    }

    void import('maplibre-gl').then(({ default: maplibregl }) => {
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
    })
  }, [mapReady, onSelect, stations])

  const moveToCurrentLocation = () => {
    if (locating || typeof window === 'undefined') return
    if (!mapReady || !mapRef.current || !mapLibRef.current) {
      Toast.show({ content: currentLocationUnavailable, icon: 'fail' })
      return
    }
    if (!('geolocation' in navigator)) {
      Toast.show({ content: currentLocationUnavailable, icon: 'fail' })
      return
    }

    setLocating(true)

    navigator.geolocation.getCurrentPosition(
      position => {
        try {
          const map = mapRef.current
          const maplibregl = mapLibRef.current

          if (!map || !maplibregl) {
            setLocating(false)
            return
          }

          const lngLat: [number, number] = [position.coords.longitude, position.coords.latitude]

          if (!currentLocationMarkerRef.current) {
            const marker = new maplibregl.Marker({
              color: getThemeColor('--app-map-marker-primary'),
              scale: 1.1,
            })
            marker.setLngLat(lngLat)
            marker.addTo(map)
            currentLocationMarkerRef.current = marker
          } else {
            currentLocationMarkerRef.current.setLngLat(lngLat)
          }

          map.flyTo({ center: lngLat, zoom: CURRENT_LOCATION_ZOOM })
        } catch {
          Toast.show({ content: currentLocationUnavailable, icon: 'fail' })
        } finally {
          setLocating(false)
        }
      },
      error => {
        Toast.show({ content: error?.message || currentLocationUnavailable, icon: 'fail' })
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 }
    )
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          background: 'var(--app-color-surface-muted)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <button
          type='button'
          aria-label={zoomInAriaLabel}
          onClick={() => {
            mapRef.current?.zoomIn()
          }}
          style={mapControlButtonStyle}
        >
          <AddOutline fontSize={20} />
        </button>
        <button
          type='button'
          aria-label={zoomOutAriaLabel}
          onClick={() => {
            mapRef.current?.zoomOut()
          }}
          style={mapControlButtonStyle}
        >
          <MinusOutline fontSize={20} />
        </button>
        <button
          type='button'
          aria-label={currentLocationAriaLabel}
          onClick={moveToCurrentLocation}
          style={mapControlButtonStyle}
        >
          <TravelOutline fontSize={locating ? 18 : 20} />
        </button>
      </div>
    </div>
  )
}

const mapControlButtonStyle: CSSProperties = {
  width: 42,
  height: 42,
  border: '1px solid var(--app-color-border)',
  borderRadius: 14,
  background: 'var(--app-map-overlay)',
  color: 'var(--app-color-title)',
  boxShadow: 'var(--app-shadow-raised)',
  fontSize: 22,
  fontWeight: 700,
  lineHeight: 1,
  display: 'grid',
  placeItems: 'center',
  cursor: 'pointer',
}
