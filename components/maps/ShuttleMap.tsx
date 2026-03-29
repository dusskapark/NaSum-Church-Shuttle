import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import type { Marker } from 'maplibre-gl'
import { useMapLibre } from '../../hooks/useMapLibre'
import { getThemeColor } from '../../lib/theme'
import type { Nullable, Station } from '../../lib/types'
import MapControls from './MapControls'

const CHURCH_LNG = 103.8072
const CHURCH_LAT = 1.3197
const DEFAULT_ZOOM = 13
const FOCUSED_ZOOM = 14
const CURRENT_LOCATION_ZOOM = 15

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
  const churchMarkerRef = useRef<Nullable<Marker>>(null)
  const myStationMarkerRef = useRef<Nullable<Marker>>(null)
  const stationMarkersRef = useRef<Marker[]>([])
  const { containerRef, mapRef, mapLibRef, mapReady, locating, moveToCurrentLocation } = useMapLibre({
    center: [CHURCH_LNG, CHURCH_LAT],
    zoom: DEFAULT_ZOOM,
    currentLocationZoom: CURRENT_LOCATION_ZOOM,
    currentLocationUnavailable,
  })

  useEffect(() => {
    if (!mapReady || !mapRef.current || !mapLibRef.current || churchMarkerRef.current) {
      return
    }

    const map = mapRef.current
    const maplibregl = mapLibRef.current
    const churchMarkerColor = getThemeColor('--app-map-marker-danger')

    churchMarkerRef.current = new maplibregl.Marker({ color: churchMarkerColor })
      .setLngLat([CHURCH_LNG, CHURCH_LAT])
      .setPopup(new maplibregl.Popup({ offset: 25 }).setText("SBC (S'Pore Bible Coll)"))
      .addTo(map)

    return () => {
      churchMarkerRef.current?.remove()
      churchMarkerRef.current = null
    }
  }, [mapReady, mapLibRef, mapRef])

  useEffect(() => {
    if (!mapReady || !mapRef.current || !mapLibRef.current) {
      return
    }

    const map = mapRef.current
    const maplibregl = mapLibRef.current
    const stationMarkerColor = getThemeColor('--app-map-marker-muted')
    const activeMarkerColor = getThemeColor('--app-map-marker-active')

    stationMarkersRef.current.forEach(marker => marker.remove())
    stationMarkersRef.current = stations
      .filter(station => !station.is_terminal)
      .map(station =>
        new maplibregl.Marker({ color: stationMarkerColor })
          .setLngLat([station.lng, station.lat])
          .setPopup(new maplibregl.Popup({ offset: 25 }).setText(station.name))
          .addTo(map)
      )

    myStationMarkerRef.current?.remove()
    myStationMarkerRef.current = null

    if (!myStation) {
      return
    }

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
  }, [mapReady, mapLibRef, mapRef, myStation, stations])

  useEffect(() => {
    return () => {
      churchMarkerRef.current?.remove()
      myStationMarkerRef.current?.remove()
      stationMarkersRef.current.forEach(marker => marker.remove())
      churchMarkerRef.current = null
      myStationMarkerRef.current = null
      stationMarkersRef.current = []
    }
  }, [])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 300 }}>
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
        buttonStyle={overlayButtonStyle}
      />
    </div>
  )
}

const overlayButtonStyle: CSSProperties = {
  background: 'rgba(255, 255, 255, 0.94)',
  backdropFilter: 'blur(8px)',
}
