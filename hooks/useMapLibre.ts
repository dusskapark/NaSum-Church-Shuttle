import { Toast } from 'antd-mobile'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Map as MapLibreMap, MapOptions, Marker } from 'maplibre-gl'
import { useAppSettings } from '../lib/app-settings'
import { getBaseMapStyle } from '../lib/mapStyle'
import { getThemeColor } from '../lib/theme'
import type { Nullable } from '../lib/types'

type MapLibreModule = typeof import('maplibre-gl')

interface UseMapLibreOptions {
  center: [number, number]
  zoom: number
  currentLocationZoom?: number
  currentLocationUnavailable?: string
  mapOptions?: Partial<MapOptions>
}

export function useMapLibre({
  center,
  zoom,
  currentLocationZoom = 15,
  currentLocationUnavailable = 'Unable to access your location.',
  mapOptions = {},
}: UseMapLibreOptions) {
  const { isDark } = useAppSettings()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<Nullable<MapLibreMap>>(null)
  const mapLibRef = useRef<Nullable<MapLibreModule>>(null)
  const currentLocationMarkerRef = useRef<Nullable<Marker>>(null)
  const [mapReady, setMapReady] = useState(false)
  const [locating, setLocating] = useState(false)
  const initialOptionsRef = useRef({ center, zoom, mapOptions, isDark })

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return
    }

    let disposed = false
    let map: Nullable<MapLibreMap> = null

    void import('maplibre-gl').then(maplibregl => {
      if (disposed || !containerRef.current) {
        return
      }

      mapLibRef.current = maplibregl
      map = new maplibregl.Map({
        container: containerRef.current,
        style: getBaseMapStyle(initialOptionsRef.current.isDark),
        center: initialOptionsRef.current.center,
        zoom: initialOptionsRef.current.zoom,
        attributionControl: false,
        ...initialOptionsRef.current.mapOptions,
      })

      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
      map.on('load', () => {
        if (!disposed) {
          setMapReady(true)
        }
      })

      mapRef.current = map
    })

    return () => {
      disposed = true
      currentLocationMarkerRef.current?.remove()
      currentLocationMarkerRef.current = null
      map?.remove()
      mapRef.current = null
      mapLibRef.current = null
      setMapReady(false)
    }
  }, [])

  useEffect(() => {
    if (!mapRef.current) {
      return
    }

    mapRef.current.setStyle(getBaseMapStyle(isDark))
  }, [isDark])

  const moveToCurrentLocation = useCallback(() => {
    if (locating || typeof window === 'undefined') {
      return
    }

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

          map.flyTo({ center: lngLat, zoom: currentLocationZoom })
        } catch {
          Toast.show({ content: currentLocationUnavailable, icon: 'fail' })
        } finally {
          setLocating(false)
        }
      },
      error => {
        const message =
          error?.message && error.message !== 'User denied Geolocation'
            ? error.message
            : currentLocationUnavailable

        Toast.show({ content: message || currentLocationUnavailable, icon: 'fail' })
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 }
    )
  }, [currentLocationUnavailable, currentLocationZoom, locating, mapReady])

  return {
    containerRef,
    mapRef,
    mapLibRef,
    mapReady,
    locating,
    moveToCurrentLocation,
  }
}
