/**
 * Google Maps React 훅
 * Google Maps API를 React에서 쉽게 사용할 수 있도록 하는 커스텀 훅
 */

import { useRef, useEffect, useState, useCallback } from 'react'
import { logError } from '../lib/logger'
import {
  createGoogleMap,
  applyDarkMode,
  createMarker,
  createInfoWindow,
  fitMapToBounds,
  type GoogleMapMarker,
  type Coordinate
} from '../lib/googleMaps'

interface MarkerData {
  id: string
  position: Coordinate
  title?: string
  content?: string
  icon?: string | google.maps.Icon
}

interface UseGoogleMapsProps {
  center?: Coordinate
  zoom?: number
  markers?: MarkerData[]
  isDark?: boolean
  onMapClick?: (event: google.maps.MapMouseEvent) => void
  onMarkerClick?: (marker: MarkerData) => void
}

interface UseGoogleMapsReturn {
  mapRef: React.RefObject<HTMLDivElement | null>
  map: google.maps.Map | null
  isLoading: boolean
  error: string | null
  addMarker: (marker: MarkerData) => void
  removeMarker: (markerId: string) => void
  clearMarkers: () => void
  fitBounds: (coordinates: Coordinate[]) => void
  setCenter: (center: Coordinate) => void
  setZoom: (zoom: number) => void
}

export function useGoogleMaps(props: UseGoogleMapsProps = {}): UseGoogleMapsReturn {
  const {
    center,
    zoom = 11,
    markers = [],
    isDark = false,
    onMapClick,
    onMarkerClick
  } = props

  const mapRef = useRef<HTMLDivElement>(null)
  const initialCenterRef = useRef(center)
  const initialZoomRef = useRef(zoom)
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 마커 관리
  const markersRef = useRef<Map<string, GoogleMapMarker>>(new Map())
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null)

  // 맵 초기화
  useEffect(() => {
    if (!mapRef.current) return

    const initMap = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const mapInstance = await createGoogleMap(mapRef.current!, {
          center: initialCenterRef.current,
          zoom: initialZoomRef.current
        })

        setMap(mapInstance)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Google Maps 로드 실패')
        logError('Google Maps initialization failed:', err)
      } finally {
        setIsLoading(false)
      }
    }

    void initMap()
  }, [])

  useEffect(() => {
    if (!map || !center) return
    map.setCenter(center)
  }, [map, center])

  useEffect(() => {
    if (!map) return
    map.setZoom(zoom)
  }, [map, zoom])

  useEffect(() => {
    if (!map || !onMapClick) return

    const listener = map.addListener('click', onMapClick)
    return () => {
      listener.remove()
    }
  }, [map, onMapClick])

  // 다크모드 적용
  useEffect(() => {
    if (map) {
      applyDarkMode(map, isDark)
    }
  }, [map, isDark])

  // 마커 추가/업데이트
  useEffect(() => {
    if (!map) return

    // 기존 마커 제거
    markersRef.current.forEach(marker => marker.remove())
    markersRef.current.clear()

    // 새 마커 추가
    markers.forEach(markerData => {
      const marker = createMarker(map, markerData.position, {
        title: markerData.title,
        icon: markerData.icon
      })

      // 마커 클릭 이벤트
      marker.addClickListener(() => {
        // 기존 정보창 닫기
        if (infoWindowRef.current) {
          infoWindowRef.current.close()
        }

        // 새 정보창 열기
        if (markerData.content) {
          const infoWindow = createInfoWindow(markerData.content)
          infoWindow.open({ map, anchor: marker.anchor })
          infoWindowRef.current = infoWindow
        }

        // 콜백 호출
        onMarkerClick?.(markerData)
      })

      markersRef.current.set(markerData.id, marker)
    })
  }, [map, markers, onMarkerClick])

  // 마커 추가
  const addMarker = useCallback((markerData: MarkerData) => {
    if (!map) return

    const marker = createMarker(map, markerData.position, {
      title: markerData.title,
      icon: markerData.icon
    })

    marker.addClickListener(() => {
      if (infoWindowRef.current) {
        infoWindowRef.current.close()
      }

      if (markerData.content) {
        const infoWindow = createInfoWindow(markerData.content)
        infoWindow.open({ map, anchor: marker.anchor })
        infoWindowRef.current = infoWindow
      }

      onMarkerClick?.(markerData)
    })

    markersRef.current.set(markerData.id, marker)
  }, [map, onMarkerClick])

  // 마커 제거
  const removeMarker = useCallback((markerId: string) => {
    const marker = markersRef.current.get(markerId)
    if (marker) {
      marker.remove()
      markersRef.current.delete(markerId)
    }
  }, [])

  // 모든 마커 제거
  const clearMarkers = useCallback(() => {
    markersRef.current.forEach(marker => marker.remove())
    markersRef.current.clear()

    if (infoWindowRef.current) {
      infoWindowRef.current.close()
    }
  }, [])

  // 경계에 맞게 조정
  const fitBounds = useCallback((coordinates: Coordinate[]) => {
    if (map && coordinates.length > 0) {
      fitMapToBounds(map, coordinates)
    }
  }, [map])

  // 중심 설정
  const setCenter = useCallback((newCenter: Coordinate) => {
    if (map) {
      map.setCenter(newCenter)
    }
  }, [map])

  // 줌 설정
  const setZoom = useCallback((newZoom: number) => {
    if (map) {
      map.setZoom(newZoom)
    }
  }, [map])

  // 정리
  useEffect(() => {
    return () => {
      if (infoWindowRef.current) {
        infoWindowRef.current.close()
      }
      clearMarkers()
    }
  }, [clearMarkers])

  return {
    mapRef,
    map,
    isLoading,
    error,
    addMarker,
    removeMarker,
    clearMarkers,
    fitBounds,
    setCenter,
    setZoom
  }
}

export type { UseGoogleMapsProps, UseGoogleMapsReturn, MarkerData }
