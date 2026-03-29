import { useEffect, useRef } from 'react'

// Church location: 9 Adam Rd, Singapore Bible College
const CHURCH_LNG = 103.8072
const CHURCH_LAT = 1.3197

export default function ShuttleMap({ stations = [], myStation = null }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    let map
    import('maplibre-gl').then(({ default: maplibregl }) => {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center: [CHURCH_LNG, CHURCH_LAT],
        zoom: 13,
        attributionControl: false,
      })

      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')

      map.on('load', () => {
        // Church marker (red)
        new maplibregl.Marker({ color: '#ef4444' })
          .setLngLat([CHURCH_LNG, CHURCH_LAT])
          .setPopup(new maplibregl.Popup({ offset: 25 }).setText('SBC (S\'Pore Bible Coll)'))
          .addTo(map)

        // Route station markers (gray)
        for (const station of stations) {
          if (station.is_terminal) continue
          new maplibregl.Marker({ color: '#9ca3af' })
            .setLngLat([station.lng, station.lat])
            .setPopup(new maplibregl.Popup({ offset: 25 }).setText(station.name))
            .addTo(map)
        }

        // My station marker (blue, larger)
        if (myStation) {
          new maplibregl.Marker({ color: '#3b82f6', scale: 1.3 })
            .setLngLat([myStation.lng, myStation.lat])
            .setPopup(
              new maplibregl.Popup({ offset: 25 })
                .setHTML(`<strong>${myStation.name}</strong><br/>${myStation.pickup_time ?? ''}`)
            )
            .addTo(map)

          map.flyTo({ center: [myStation.lng, myStation.lat], zoom: 14 })
        }
      })

      mapRef.current = map
    })

    return () => {
      map?.remove()
      mapRef.current = null
    }
  }, [])

  // Update markers when myStation changes after initial load
  useEffect(() => {
    if (!mapRef.current || !myStation) return
    mapRef.current.flyTo({ center: [myStation.lng, myStation.lat], zoom: 14 })
  }, [myStation?.id])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', minHeight: 300 }}
    />
  )
}
