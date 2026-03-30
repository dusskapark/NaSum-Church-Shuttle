/**
 * Google Maps 기반 맵 컴포넌트들
 * MapLibre를 Google Maps로 교체한 버전
 */

import { useEffect, useRef } from 'react'
import { Button } from 'antd-mobile'
import { useGoogleMaps, type MarkerData } from '../hooks/useGoogleMaps'
import { getThemeColor } from '../lib/theme'
import type {
  Nullable,
  PlaceSummary,
  RoutePathPoint,
  RouteStopWithPlace,
  StopCandidate,
} from '../lib/types'
import type { Coordinate } from '../lib/googleMaps'

// Shuttle Map Component (for Home page)
const CHURCH_LNG = 103.8072
const CHURCH_LAT = 1.3197
// 한인교회 앞 (9 Adam Rd, Singapore 289886) 정확한 좌표
const KOREAN_CHURCH_LNG = 103.813124
const KOREAN_CHURCH_LAT = 1.32547
const DEFAULT_ZOOM = 13
const FOCUSED_ZOOM = 14
const CURRENT_LOCATION_ZOOM = 15

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function useCurrentLocationControl(
  map: google.maps.Map | null,
  setCenter: (center: Coordinate) => void,
  setZoom: (zoom: number) => void,
  currentLocationAriaLabel: string,
  currentLocationUnavailable: string
) {
  useEffect(() => {
    if (!map || !window.google?.maps?.ControlPosition) {
      return
    }

    const controlButton = document.createElement('button')
    controlButton.type = 'button'
    controlButton.setAttribute('aria-label', currentLocationAriaLabel)
    controlButton.title = currentLocationAriaLabel
    controlButton.innerHTML = `
      <span style="font-size:18px; line-height:1;">◎</span>
    `
    Object.assign(controlButton.style, {
      backgroundColor: '#ffffff',
      border: '0',
      borderRadius: '2px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
      cursor: 'pointer',
      marginTop: '12px',
      marginRight: '10px',
      width: '40px',
      height: '40px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#1f2937',
    })

    let locating = false

    const handleClick = () => {
      if (locating) {
        return
      }

      if (!('geolocation' in navigator)) {
        alert(currentLocationUnavailable)
        return
      }

      locating = true
      controlButton.disabled = true
      controlButton.style.opacity = '0.7'

      navigator.geolocation.getCurrentPosition(
        position => {
          setCenter({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          })
          setZoom(CURRENT_LOCATION_ZOOM)
          locating = false
          controlButton.disabled = false
          controlButton.style.opacity = '1'
        },
        () => {
          alert(currentLocationUnavailable)
          locating = false
          controlButton.disabled = false
          controlButton.style.opacity = '1'
        }
      )
    }

    controlButton.addEventListener('click', handleClick)
    map.controls[window.google.maps.ControlPosition.RIGHT_TOP].push(controlButton)

    return () => {
      controlButton.removeEventListener('click', handleClick)
      controlButton.remove()
    }
  }, [currentLocationAriaLabel, currentLocationUnavailable, map, setCenter, setZoom])
}

interface ShuttleMapProps {
  stops?: RouteStopWithPlace[]
  cachedPath?: RoutePathPoint[]
  pathCacheStatus?: Nullable<string>
  myStop?: Nullable<RouteStopWithPlace>
  currentLocationAriaLabel?: string
  currentLocationUnavailable?: string
}

export function ShuttleMap({
  stops = [],
  cachedPath = [],
  pathCacheStatus = null,
  myStop = null,
  currentLocationAriaLabel = 'Move to my current location',
  currentLocationUnavailable = 'Unable to access your location.',
}: ShuttleMapProps) {
  const routePolylineRef = useRef<google.maps.Polyline | null>(null)

  // 기본 마커들 (교회, 스테이션들)
  const baseMarkers: MarkerData[] = [
    // SBC 마커
    {
      id: 'sbc-church',
      position: { lat: CHURCH_LAT, lng: CHURCH_LNG },
      title: "SBC (S'Pore Bible Coll)",
      content: `
        <div style="padding: 8px;">
          <strong>SBC (S'Pore Bible Coll)</strong>
        </div>
      `,
      // 빨간색 마커
      icon: {
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#DC2626"/>
            <circle cx="12" cy="9" r="2.5" fill="white"/>
          </svg>
        `)}`,
        // scaledSize와 anchor는 Google Maps API 로드 후 설정
      },
    },
    // 한인교회 마커
    {
      id: 'korean-church',
      position: { lat: KOREAN_CHURCH_LAT, lng: KOREAN_CHURCH_LNG },
      title: 'Korean Church (9 Adam Rd)',
      content: `
        <div style="padding: 8px;">
          <strong>Korean Church (9 Adam Rd)</strong>
        </div>
      `,
      icon: {
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#DC2626"/>
            <circle cx="12" cy="9" r="2.5" fill="white"/>
          </svg>
        `)}`,
        // scaledSize와 anchor는 Google Maps API 로드 후 설정
      },
    },
    // 스테이션 마커들
    ...stops
      .filter(stop => !stop.place.is_terminal)
      .map(stop => {
        const stopName = stop.place.display_name ?? stop.place.name

        return {
          id: stop.id,
          position: { lat: stop.place.lat, lng: stop.place.lng },
          title: stopName,
          content: `
            <div style="padding: 8px;">
              <strong>${escapeHtml(stopName)}</strong>
            </div>
          `,
          icon: myStop?.id === stop.id ? {
          // 내 스테이션 - 강조 마커
            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#2563EB"/>
                <circle cx="12" cy="9" r="2.5" fill="white"/>
              </svg>
            `)}`,
          // scaledSize와 anchor는 Google Maps API 로드 후 설정
          } : {
          // 일반 스테이션 마커
            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#64748B"/>
                <circle cx="12" cy="9" r="2.5" fill="white"/>
              </svg>
            `)}`,
          // scaledSize와 anchor는 Google Maps API 로드 후 설정
          },
        }
      })
  ]

  const {
    mapRef,
    map,
    isLoading,
    error,
    setCenter,
    setZoom,
  } = useGoogleMaps({
    center: { lat: CHURCH_LAT, lng: CHURCH_LNG },
    zoom: DEFAULT_ZOOM,
    markers: baseMarkers,
  })

  // 버스 루트 그리기
  useEffect(() => {
    if (!map) return

    if (routePolylineRef.current) {
      routePolylineRef.current.setMap(null)
      routePolylineRef.current = null
    }

    if (pathCacheStatus !== 'ready' || cachedPath.length === 0 || !window.google?.maps?.Polyline) {
      return
    }

    const polyline = new window.google.maps.Polyline({
      path: cachedPath,
      geodesic: true,
      strokeColor: getThemeColor('--app-map-marker-primary'),
      strokeOpacity: 0.8,
      strokeWeight: 4,
    })

    polyline.setMap(map)
    routePolylineRef.current = polyline
  }, [cachedPath, map, pathCacheStatus, stops])

  // 내 스테이션으로 포커스
  useEffect(() => {
    if (myStop && map) {
      setCenter({ lat: myStop.place.lat, lng: myStop.place.lng })
      setZoom(FOCUSED_ZOOM)
    }
  }, [myStop, map, setCenter, setZoom])

  useCurrentLocationControl(
    map,
    setCenter,
    setZoom,
    currentLocationAriaLabel,
    currentLocationUnavailable
  )

  // 정리
  useEffect(() => {
    return () => {
      if (routePolylineRef.current) {
        routePolylineRef.current.setMap(null)
      }
    }
  }, [])

  if (error) {
    return (
      <div style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--app-color-surface)'
      }}>
        <div style={{ textAlign: 'center', padding: 20 }}>
          <p style={{ color: 'var(--app-color-danger)', marginBottom: 8 }}>
            지도를 불러올 수 없습니다
          </p>
          <p style={{ color: 'var(--app-color-subtitle)', fontSize: 12 }}>
            {error}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 300 }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
      {isLoading && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(255, 255, 255, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 32,
              height: 32,
              border: '3px solid #f3f3f3',
              borderTop: '3px solid #2563EB',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 8px'
            }} />
            <p style={{ fontSize: 14, color: 'var(--app-color-subtitle)' }}>
              지도 로딩 중...
            </p>
          </div>
        </div>
      )}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

// Station Browser Map Component (for Search page)
const BROWSER_DEFAULT_CENTER: Coordinate = { lat: 1.3521, lng: 103.8198 }
const BROWSER_DEFAULT_ZOOM = 11

interface StationBrowserMapProps {
  places?: PlaceSummary[]
  onSelect?: (googlePlaceId: string) => void
  currentLocationAriaLabel?: string
  currentLocationUnavailable?: string
}

export function StationBrowserMap({
  places = [],
  onSelect,
  currentLocationAriaLabel = 'Move to my current location',
  currentLocationUnavailable = 'Unable to access your location.',
}: StationBrowserMapProps) {
  // 스테이션 마커들
  const stationMarkers: MarkerData[] = places.map(place => ({
    id: place.googlePlaceId,
    position: { lat: place.lat, lng: place.lng },
    title: place.name,
    content: `
      <div style="padding: 8px;">
        <strong>${escapeHtml(place.name)}</strong>
      </div>
    `,
    icon: {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#2563EB"/>
          <circle cx="12" cy="9" r="2.5" fill="white"/>
        </svg>
      `)}`,
      // scaledSize와 anchor는 Google Maps API 로드 후 설정
    },
  }))

  // 중심점과 줌 계산
  const center = places.length === 0
    ? BROWSER_DEFAULT_CENTER
    : places.length === 1
    ? { lat: places[0].lat, lng: places[0].lng }
    : {
        lat: places.reduce((sum, place) => sum + place.lat, 0) / places.length,
        lng: places.reduce((sum, place) => sum + place.lng, 0) / places.length,
      }

  const zoom = places.length === 0
    ? BROWSER_DEFAULT_ZOOM
    : places.length === 1
    ? 14
    : BROWSER_DEFAULT_ZOOM

  const {
    mapRef,
    map,
    isLoading,
    error,
    fitBounds,
    setCenter,
    setZoom,
  } = useGoogleMaps({
    center,
    zoom,
    markers: stationMarkers,
    onMarkerClick: (marker) => {
      onSelect?.(marker.id)
    },
  })

  // 스테이션들에 맞게 경계 조정
  useEffect(() => {
    if (places.length > 1 && map) {
      const coordinates = places.map(place => ({ lat: place.lat, lng: place.lng }))
      fitBounds(coordinates)
    }
  }, [places, map, fitBounds])

  useCurrentLocationControl(
    map,
    setCenter,
    setZoom,
    currentLocationAriaLabel,
    currentLocationUnavailable
  )

  if (error) {
    return (
      <div style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--app-color-surface)'
      }}>
        <div style={{ textAlign: 'center', padding: 20 }}>
          <p style={{ color: 'var(--app-color-danger)', marginBottom: 8 }}>
            지도를 불러올 수 없습니다
          </p>
          <p style={{ color: 'var(--app-color-subtitle)', fontSize: 12 }}>
            {error}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
      {isLoading && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(255, 255, 255, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 32,
              height: 32,
              border: '3px solid #f3f3f3',
              borderTop: '3px solid #2563EB',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 8px'
            }} />
            <p style={{ fontSize: 14, color: 'var(--app-color-subtitle)' }}>
              지도 로딩 중...
            </p>
          </div>
        </div>
      )}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

// Stop Preview Map Component (for Stop details page)
interface StopPreviewMapProps {
  stop?: Nullable<StopCandidate>
  previewLabel?: string
  routeMapLabel?: string
  googleMapsLabel?: string
}

export function StopPreviewMap({
  stop = null,
  previewLabel = 'Stop location preview',
  routeMapLabel = 'Route map',
  googleMapsLabel = 'Open in Google Maps',
}: StopPreviewMapProps) {
  const stopLocationHref = stop
    ? `https://www.google.com/maps/search/?api=1&query=${stop.lat},${stop.lng}`
    : null
  const routeMapHref = stop?.googleMapsUrl ?? stopLocationHref

  const markers: MarkerData[] = stop ? [{
    id: 'stop-preview',
    position: { lat: stop.lat, lng: stop.lng },
    title: stop.name || '정류장',
    content: `
      <div style="padding: 8px;">
        <strong>${escapeHtml(stop.name || '정류장')}</strong>
      </div>
    `,
    icon: {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#2563EB"/>
          <circle cx="12" cy="9" r="2.5" fill="white"/>
        </svg>
      `)}`,
      // scaledSize와 anchor는 Google Maps API 로드 후 설정
    },
  }] : []

  const { mapRef, isLoading, error } = useGoogleMaps({
    center: stop ? { lat: stop.lat, lng: stop.lng } : BROWSER_DEFAULT_CENTER,
    zoom: 15,
    markers,
    // 정적 맵으로 만들기 위한 옵션들은 Google Maps에서는 맵 옵션으로 설정
  })

  // 맵을 정적으로 만들기 위한 효과
  useEffect(() => {
    // Google Maps의 상호작용을 비활성화하는 옵션들은 mapRef를 통해 직접 설정해야 함
  }, [])

  if (error) {
    return (
      <div style={{ padding: 16, paddingBottom: 8 }}>
        <div style={{
          marginBottom: 10,
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--app-color-subtle-text)',
        }}>
          {previewLabel}
        </div>
        <div style={{
          overflow: 'hidden',
          borderRadius: 18,
          background: 'var(--app-color-surface)',
          boxShadow: 'var(--app-shadow-raised)',
          padding: 20,
          textAlign: 'center'
        }}>
          <p style={{ color: 'var(--app-color-danger)', marginBottom: 8 }}>
            지도를 불러올 수 없습니다
          </p>
          <p style={{ color: 'var(--app-color-subtitle)', fontSize: 12 }}>
            {error}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: 16, paddingBottom: 8 }}>
      <div
        style={{
          marginBottom: 10,
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--app-color-subtle-text)',
        }}
      >
        {previewLabel}
      </div>
      <div
        style={{
          overflow: 'hidden',
          borderRadius: 18,
          background: 'var(--app-color-surface)',
          boxShadow: 'var(--app-shadow-raised)',
        }}
      >
        <div style={{ position: 'relative' }}>
          <div ref={mapRef} style={{ width: '100%', height: 220 }} />
          {isLoading && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(255, 255, 255, 0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <div style={{
                width: 24,
                height: 24,
                border: '2px solid #f3f3f3',
                borderTop: '2px solid #2563EB',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }} />
            </div>
          )}
        </div>
        <div
          style={{
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap',
            padding: '12px 14px',
            background: 'var(--adm-color-background)',
            borderTop: '1px solid var(--app-color-border)',
          }}
        >
          <Button
            fill='none'
            size='small'
            onClick={() => {
              if (routeMapHref) {
                window.open(routeMapHref, '_blank', 'noopener,noreferrer')
              }
            }}
            style={{
              padding: 0,
              color: 'var(--app-color-link)',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {routeMapLabel}
          </Button>
          <Button
            fill='none'
            size='small'
            onClick={() => {
              if (stopLocationHref) {
                window.open(stopLocationHref, '_blank', 'noopener,noreferrer')
              }
            }}
            style={{
              padding: 0,
              color: 'var(--app-color-link)',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {googleMapsLabel}
          </Button>
        </div>
      </div>
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
