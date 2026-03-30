/**
 * Google Maps React 컴포넌트
 * MapLibre를 대체하는 Google Maps 렌더링 컴포넌트
 */

import { forwardRef, useImperativeHandle } from 'react'
import { useGoogleMaps, type MarkerData, type UseGoogleMapsProps } from '../hooks/useGoogleMaps'
import type { Coordinate } from '../lib/googleMaps'

interface GoogleMapProps extends Omit<UseGoogleMapsProps, 'isDark'> {
  className?: string
  style?: React.CSSProperties
  height?: string | number
  width?: string | number
  loading?: React.ReactNode
  error?: React.ReactNode
}

export interface GoogleMapRef {
  map: google.maps.Map | null
  addMarker: (marker: MarkerData) => void
  removeMarker: (markerId: string) => void
  clearMarkers: () => void
  fitBounds: (coordinates: Coordinate[]) => void
  setCenter: (center: Coordinate) => void
  setZoom: (zoom: number) => void
}

export const GoogleMap = forwardRef<GoogleMapRef, GoogleMapProps>(
  function GoogleMapComponent(props, ref) {
    const {
      className = '',
      style,
      height = '400px',
      width = '100%',
      loading,
      error: errorComponent,
      ...mapProps
    } = props

    const isDark = false

    const {
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
    } = useGoogleMaps({
      ...mapProps,
      isDark
    })

    // ref를 통해 외부에서 맵 제어 가능하도록
    useImperativeHandle(ref, () => ({
      map,
      addMarker,
      removeMarker,
      clearMarkers,
      fitBounds,
      setCenter,
      setZoom
    }), [map, addMarker, removeMarker, clearMarkers, fitBounds, setCenter, setZoom])

    const containerStyle: React.CSSProperties = {
      width,
      height,
      position: 'relative',
      ...style
    }

    const mapStyle: React.CSSProperties = {
      width: '100%',
      height: '100%',
      borderRadius: '8px'
    }

    if (error) {
      return (
        <div className={`flex items-center justify-center ${className}`} style={containerStyle}>
          {errorComponent || (
            <div className="text-center p-4">
              <p className="text-red-500 mb-2">지도를 불러올 수 없습니다</p>
              <p className="text-sm text-gray-500">{error}</p>
            </div>
          )}
        </div>
      )
    }

    return (
      <div className={`relative ${className}`} style={containerStyle}>
        {/* 맵 컨테이너 */}
        <div
          ref={mapRef}
          style={mapStyle}
          className="bg-gray-100 dark:bg-gray-800"
        />

        {/* 로딩 오버레이 */}
        {isLoading && (
          <div className="absolute inset-0 bg-white/80 dark:bg-gray-800/80 flex items-center justify-center rounded-lg z-10">
            {loading || (
              <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                <p className="text-sm text-gray-600 dark:text-gray-300">지도 로딩 중...</p>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }
)

/**
 * 간단한 사용법을 위한 기본 GoogleMap 컴포넌트
 */
interface SimpleGoogleMapProps {
  stations?: Array<{
    id: string
    name: string
    lat: number
    lng: number
  }>
  center?: Coordinate
  zoom?: number
  className?: string
  height?: string | number
  onStationClick?: (station: any) => void
}

export function SimpleGoogleMap({
  stations = [],
  center,
  zoom = 11,
  className,
  height = '400px',
  onStationClick
}: SimpleGoogleMapProps) {
  // 스테이션을 마커 데이터로 변환
  const markers: MarkerData[] = stations.map(station => ({
    id: station.id,
    position: { lat: station.lat, lng: station.lng },
    title: station.name,
    content: `
      <div class="p-2">
        <h3 class="font-semibold text-sm">${station.name}</h3>
        <p class="text-xs text-gray-600">버스 정류장</p>
      </div>
    `
  }))

  // 스테이션들의 중심점 계산
  const calculatedCenter = center || (stations.length > 0 ? {
    lat: stations.reduce((sum, s) => sum + s.lat, 0) / stations.length,
    lng: stations.reduce((sum, s) => sum + s.lng, 0) / stations.length
  } : undefined)

  return (
    <GoogleMap
      className={className}
      height={height}
      center={calculatedCenter}
      zoom={zoom}
      markers={markers}
      onMarkerClick={(marker) => {
        const station = stations.find(s => s.id === marker.id)
        if (station && onStationClick) {
          onStationClick(station)
        }
      }}
    />
  )
}

export default GoogleMap
