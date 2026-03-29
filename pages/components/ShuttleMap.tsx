import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Toast } from 'antd-mobile'
import { AddOutline, MinusOutline, TravelOutline } from 'antd-mobile-icons'
import type { Map as MapLibreMap, Marker } from 'maplibre-gl'
import { useAppSettings } from '../../lib/app-settings'
import { getBaseMapStyle } from '../../lib/mapStyle'
import { getThemeColor } from '../../lib/theme'
import type { Nullable, Station } from '../../lib/types'

const CHURCH_LNG = 103.8072
const CHURCH_LAT = 1.3197
const DEFAULT_ZOOM = 13
const FOCUSED_ZOOM = 14
const CURRENT_LOCATION_ZOOM = 15
const LOCATION_ERROR_MESSAGE = 'Unable to access your location.'

type MapLibreModule = typeof import('maplibre-gl')

interface ShuttleMapProps {
  stations?: Station[]
  myStation?: Nullable<Station>
  zoomInAriaLabel?: string
  zoomOutAriaLabel?: string
  currentLocationAriaLabel?: string
  currentLocationUnavailable?: string
}

export default function ShuttleMap({
  stations = [],
  myStation = null,
  zoomInAriaLabel = 'Zoom in',
  zoomOutAriaLabel = 'Zoom out',
  currentLocationAriaLabel = 'Move to my current location',
  currentLocationUnavailable = 'Unable to access your location.',
}: ShuttleMapProps) {
  const { isDark } = useAppSettings()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<Nullable<MapLibreMap>>(null)
  const mapLibRef = useRef<Nullable<MapLibreModule>>(null)
  const churchMarkerRef = useRef<Nullable<Marker>>(null)
  const myStationMarkerRef = useRef<Nullable<Marker>>(null)
  const currentLocationMarkerRef = useRef<Nullable<Marker>>(null)
  const stationMarkersRef = useRef<Marker[]>([])
  const [mapReady, setMapReady] = useState(false)
  const [locating, setLocating] = useState(false)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    let map: Nullable<MapLibreMap> = null
    let disposed = false

    void import('maplibre-gl').then(({ default: maplibregl }) => {
      if (disposed || !containerRef.current) return
      mapLibRef.current = maplibregl

      map = new maplibregl.Map({
        container: containerRef.current,
        style: getBaseMapStyle(isDark),
        center: [CHURCH_LNG, CHURCH_LAT],
        zoom: DEFAULT_ZOOM,
        attributionControl: false,
      })

      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')

      map.on('load', () => {
        const churchMarkerColor = getThemeColor('--app-map-marker-danger')

        churchMarkerRef.current = new maplibregl.Marker({ color: churchMarkerColor })
          .setLngLat([CHURCH_LNG, CHURCH_LAT])
          .setPopup(new maplibregl.Popup({ offset: 25 }).setText("SBC (S'Pore Bible Coll)"))
          .addTo(map as MapLibreMap)
        setMapReady(true)
      })

      mapRef.current = map
    })

    return () => {
      disposed = true
      churchMarkerRef.current?.remove()
      churchMarkerRef.current = null
      myStationMarkerRef.current?.remove()
      myStationMarkerRef.current = null
      currentLocationMarkerRef.current?.remove()
      currentLocationMarkerRef.current = null
      stationMarkersRef.current.forEach((marker) => marker.remove())
      stationMarkersRef.current = []
      map?.remove()
      mapRef.current = null
      mapLibRef.current = null
      setMapReady(false)
    }
  }, [isDark])

  useEffect(() => {
    if (!mapReady || !mapRef.current || !mapLibRef.current) return

    const map = mapRef.current
    const maplibregl = mapLibRef.current
    const stationMarkerColor = getThemeColor('--app-map-marker-muted')
    const activeMarkerColor = getThemeColor('--app-map-marker-active')

    stationMarkersRef.current.forEach((marker) => marker.remove())
    stationMarkersRef.current = stations
      .filter((station) => !station.is_terminal)
      .map((station) =>
        new maplibregl.Marker({ color: stationMarkerColor })
          .setLngLat([station.lng, station.lat])
          .setPopup(new maplibregl.Popup({ offset: 25 }).setText(station.name))
          .addTo(map)
      )

    myStationMarkerRef.current?.remove()
    myStationMarkerRef.current = null

    if (!myStation) return

    myStationMarkerRef.current = new maplibregl.Marker({
      color: activeMarkerColor,
      scale: 1.3,
    })
      .setLngLat([myStation.lng, myStation.lat])
      .setPopup(
        new maplibregl.Popup({ offset: 25 }).setHTML(
          `<strong>${myStation.name}</strong><br/>${myStation.pickup_time ?? ''}`
        )
      )
      .addTo(map)

    map.flyTo({ center: [myStation.lng, myStation.lat], zoom: FOCUSED_ZOOM })
  }, [mapReady, myStation, stations])

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
    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          try {
            const map = mapRef.current
            const maplibregl = mapLibRef.current

            if (!map || !maplibregl) {
              setLocating(false)
              return
            }

            const lngLat: [number, number] = [
              position.coords.longitude,
              position.coords.latitude,
            ]

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
        (error) => {
          const message =
            error?.message && error.message !== 'User denied Geolocation'
              ? error.message
              : currentLocationUnavailable
          Toast.show({ content: message || LOCATION_ERROR_MESSAGE, icon: 'fail' })
          setLocating(false)
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 }
      )
    } catch {
      Toast.show({ content: currentLocationUnavailable, icon: 'fail' })
      setLocating(false)
    }
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 300 }}>
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
  backdropFilter: 'blur(8px)',
}
