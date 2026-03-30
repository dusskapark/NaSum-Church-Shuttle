/**
 * Google Directions API를 사용한 라우팅 유틸리티
 * OSRM을 대체하는 Google Maps 기반 라우팅
 */

import type { Coordinate } from './googleMaps'
import { initializeGoogleMaps } from './googleMaps'

let hasWarnedRoutesApiDisabled = false
let hasWarnedRoutesPermissionDenied = false

function toLatLngLiteral(point: Coordinate | google.maps.LatLng | google.maps.LatLngLiteral | any): google.maps.LatLngLiteral {
  return {
    lat: typeof point.lat === 'function' ? point.lat() : point.lat,
    lng: typeof point.lng === 'function' ? point.lng() : point.lng,
  }
}

function createStraightLineRoute(points: Coordinate[]): google.maps.LatLngLiteral[] {
  return points.map((point) => ({ lat: point.lat, lng: point.lng }))
}

function isGoogleRoutesApiEnabled(): boolean {
  return process.env.NEXT_PUBLIC_GOOGLE_ROUTES_API_ENABLED === 'true'
}

function isPermissionDeniedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('PERMISSION_DENIED') || message.includes('blocked')
}

/**
 * 두 지점 사이의 도로 경로를 Google Routes API로 가져옵니다.
 */
export async function getGoogleDirectionsRoute(
  start: Coordinate,
  end: Coordinate,
  waypoints: Coordinate[] = []
): Promise<google.maps.LatLngLiteral[]> {
  const fallbackRoute = createStraightLineRoute([start, ...waypoints, end])

  if (typeof window === 'undefined') {
    return fallbackRoute
  }

  if (!isGoogleRoutesApiEnabled()) {
    if (!hasWarnedRoutesApiDisabled) {
      hasWarnedRoutesApiDisabled = true
      console.info(
        'Google Routes API is disabled. Set NEXT_PUBLIC_GOOGLE_ROUTES_API_ENABLED=true after enabling routes.googleapis.com to use road routing.'
      )
    }
    return fallbackRoute
  }

  try {
    await initializeGoogleMaps({ libraries: ['places', 'marker', 'routes'] })
    const routesLibrary = await google.maps.importLibrary('routes') as any
    const routeApi = routesLibrary?.Route

    if (!routeApi?.computeRoutes) {
      console.warn('Google Routes API가 아직 로드되지 않았습니다. 직선으로 fallback합니다.')
      return fallbackRoute
    }

    const response = await routeApi.computeRoutes({
      origin: start,
      destination: end,
      intermediates: waypoints.map((point) => ({
        location: point
      })),
      travelMode: google.maps.TravelMode.DRIVING,
      optimizeWaypointOrder: waypoints.length > 0,
      region: 'KR',
      fields: waypoints.length > 0
        ? ['path', 'optimizedIntermediateWaypointIndices']
        : ['path'],
    })

    const path = response.routes?.[0]?.path
    if (path?.length) {
      return path.map((point: any) => toLatLngLiteral(point))
    }

    return fallbackRoute
  } catch (error) {
    if (isPermissionDeniedError(error)) {
      if (!hasWarnedRoutesPermissionDenied) {
        hasWarnedRoutesPermissionDenied = true
        console.warn(
          'Google Routes API 권한이 없어 직선 경로로 fallback합니다. GCP에서 Routes API를 활성화하고 Maps JavaScript API 키 제한을 확인하세요.'
        )
      }
      return fallbackRoute
    }

    console.warn('Google Routes API 실패, 직선으로 fallback:', error)
    return fallbackRoute
  }
}

/**
 * 여러 정류장을 거쳐가는 전체 버스 루트를 생성합니다
 * OSRM의 createBusRoute 함수를 대체
 */
export async function createGoogleDirections(
  stations: Coordinate[],
  finalDestination: Coordinate
): Promise<google.maps.LatLngLiteral[]> {
  if (stations.length === 0) {
    return []
  }

  // 클라이언트 사이드에서만 실행
  if (typeof window === 'undefined') {
    return []
  }

  try {
    // 첫 번째 스테이션부터 마지막 목적지까지의 경로를 한 번에 계산
    const start = stations[0]
    const end = finalDestination
    const waypoints = stations.slice(1) // 첫 번째 제외한 나머지 스테이션들

    const routePoints = await getGoogleDirectionsRoute(start, end, waypoints)
    return routePoints

  } catch (error) {
    console.error('Google Routes API로 루트 생성 실패:', error)

    // 실패 시 간단한 직선 연결로 fallback
    return createStraightLineRoute([...stations, finalDestination])
  }
}

/**
 * 좌표 배열을 Google Maps LatLng 배열로 변환
 */
export function coordinatesToLatLng(coordinates: Coordinate[]): google.maps.LatLng[] {
  return coordinates.map(coord => new google.maps.LatLng(coord.lat, coord.lng))
}

/**
 * Google Maps LatLng 배열을 좌표 배열로 변환
 */
export function latLngToCoordinates(latLngs: google.maps.LatLng[]): Coordinate[] {
  return latLngs.map(latLng => ({
    lat: latLng.lat(),
    lng: latLng.lng()
  }))
}

/**
 * 경로의 총 거리를 계산합니다 (킬로미터)
 */
export function calculateRouteDistance(coordinates: Coordinate[]): number {
  if (coordinates.length < 2) return 0

  let totalDistance = 0
  for (let i = 0; i < coordinates.length - 1; i++) {
    const start = coordinates[i]
    const end = coordinates[i + 1]

    // Haversine 공식으로 거리 계산
    const R = 6371 // 지구 반지름 (km)
    const dLat = (end.lat - start.lat) * Math.PI / 180
    const dLng = (end.lng - start.lng) * Math.PI / 180
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(start.lat * Math.PI / 180) * Math.cos(end.lat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    totalDistance += R * c
  }

  return totalDistance
}

/**
 * 경로의 예상 소요 시간을 계산합니다 (분)
 * 평균 속도를 기반으로 한 추정치
 */
export function estimateTravelTime(
  distance: number,
  averageSpeed: number = 30 // km/h, 도시 내 평균 속도
): number {
  return Math.round((distance / averageSpeed) * 60) // 분 단위
}

export type { Coordinate }
