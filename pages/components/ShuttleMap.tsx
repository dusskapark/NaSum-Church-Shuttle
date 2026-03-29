import { useEffect, useRef } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { baseMapStyle } from '../../lib/mapStyle'
import type { Nullable, Station } from '../../lib/types'

const CHURCH_LNG = 103.8072
const CHURCH_LAT = 1.3197

interface ShuttleMapProps {
  stations?: Station[]
  myStation?: Nullable<Station>
}

export default function ShuttleMap({
  stations = [],
  myStation = null,
}: ShuttleMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<Nullable<MapLibreMap>>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    let map: Nullable<MapLibreMap> = null
    let disposed = false

    void import('maplibre-gl').then(({ default: maplibregl }) => {
      if (disposed || !containerRef.current) return

      map = new maplibregl.Map({
        container: containerRef.current,
        style: baseMapStyle,
        center: [CHURCH_LNG, CHURCH_LAT],
        zoom: 13,
        attributionControl: false,
      })

      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')

      map.on('load', () => {
        new maplibregl.Marker({ color: '#ef4444' })
          .setLngLat([CHURCH_LNG, CHURCH_LAT])
          .setPopup(new maplibregl.Popup({ offset: 25 }).setText("SBC (S'Pore Bible Coll)"))
          .addTo(map as MapLibreMap)

        for (const station of stations) {
          if (station.is_terminal) continue
          new maplibregl.Marker({ color: '#9ca3af' })
            .setLngLat([station.lng, station.lat])
            .setPopup(new maplibregl.Popup({ offset: 25 }).setText(station.name))
            .addTo(map as MapLibreMap)
        }

        if (myStation) {
          new maplibregl.Marker({ color: '#3b82f6', scale: 1.3 })
            .setLngLat([myStation.lng, myStation.lat])
            .setPopup(
              new maplibregl.Popup({ offset: 25 }).setHTML(
                `<strong>${myStation.name}</strong><br/>${myStation.pickup_time ?? ''}`
              )
            )
            .addTo(map as MapLibreMap)

          map?.flyTo({ center: [myStation.lng, myStation.lat], zoom: 14 })
        }
      })

      mapRef.current = map
    })

    return () => {
      disposed = true
      map?.remove()
      mapRef.current = null
    }
  }, [myStation, stations])

  useEffect(() => {
    if (!mapRef.current || !myStation) return
    mapRef.current.flyTo({ center: [myStation.lng, myStation.lat], zoom: 14 })
  }, [myStation])

  return <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 300 }} />
}
