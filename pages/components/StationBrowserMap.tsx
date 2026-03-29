import { useEffect, useRef } from 'react'
import type { LngLatBoundsLike, Map as MapLibreMap, Marker } from 'maplibre-gl'
import { baseMapStyle } from '../../lib/mapStyle'
import type { Station } from '../../lib/types'

const DEFAULT_CENTER: [number, number] = [103.8198, 1.3521]
const DEFAULT_ZOOM = 11

interface StationBrowserMapProps {
  stations?: Station[]
  onSelect?: (stationId: string) => void
}

export default function StationBrowserMap({
  stations = [],
  onSelect,
}: StationBrowserMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markersRef = useRef<Marker[]>([])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    let disposed = false

    void import('maplibre-gl').then(({ default: maplibregl }) => {
      if (disposed || !containerRef.current) return

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: baseMapStyle,
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        attributionControl: false,
      })

      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
      mapRef.current = map
    })

    return () => {
      disposed = true
      for (const marker of markersRef.current) marker.remove()
      markersRef.current = []
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    for (const marker of markersRef.current) marker.remove()
    markersRef.current = []

    if (stations.length === 0) {
      map.jumpTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM })
      return
    }

    void import('maplibre-gl').then(({ default: maplibregl }) => {
      const bounds = new maplibregl.LngLatBounds()

      for (const station of stations) {
        const marker = new maplibregl.Marker({ color: '#1677ff', scale: 0.95 })
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
  }, [onSelect, stations])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}
