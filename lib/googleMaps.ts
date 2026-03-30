/**
 * Google Maps API 유틸리티 및 설정
 * MapLibre를 대체하는 Google Maps 초기화 및 관리 함수들
 */

import { setOptions, importLibrary } from '@googlemaps/js-api-loader'

interface Coordinate {
  lng: number
  lat: number
}

interface GoogleMapsConfig {
  apiKey: string
  libraries?: string[]
  language?: string
  region?: string
  version?: string
  mapId?: string
}

// Google Maps API 초기화 상태
let isInitialized = false
let isOptionsConfigured = false
let initializationPromise: Promise<void> | null = null

// 기본 설정
const DEFAULT_CONFIG: GoogleMapsConfig = {
  apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
  libraries: ['places', 'marker', 'routes'],
  language: 'ko',
  region: 'KR',
  version: 'weekly',
  mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID'
}

// 서울/수원 지역 기본 센터 좌표
export const DEFAULT_CENTER: Coordinate = {
  lat: 37.2636,  // 수원 근처
  lng: 127.0286  // 수원 근처
}

/**
 * Google Maps API를 초기화합니다 (새로운 함수형 API)
 */
export async function initializeGoogleMaps(config?: Partial<GoogleMapsConfig>): Promise<void> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }

  if (!finalConfig.apiKey) {
    throw new Error('Google Maps API 키가 설정되지 않았습니다. NEXT_PUBLIC_GOOGLE_MAPS_API_KEY를 확인하세요.')
  }

  if (isInitialized) return
  if (initializationPromise) {
    await initializationPromise
    return
  }

  try {
    initializationPromise = (async () => {
      if (!isOptionsConfigured) {
        setOptions({
          key: finalConfig.apiKey,
          v: finalConfig.version,
          language: finalConfig.language,
          region: finalConfig.region
        })
        isOptionsConfigured = true
      }

      await importLibrary('maps')

      const libraries = finalConfig.libraries ?? []
      await Promise.all(
        libraries
          .filter((library) => library !== 'maps')
          .map((library) => importLibrary(library as Parameters<typeof importLibrary>[0]))
      )

      isInitialized = true
    })()

    await initializationPromise
  } catch (error) {
    initializationPromise = null
    console.error('Google Maps API 초기화 실패:', error)
    throw error
  }
}

/**
 * Google Maps 인스턴스를 생성합니다
 */
export async function createGoogleMap(
  container: HTMLElement,
  options?: Partial<google.maps.MapOptions>
): Promise<google.maps.Map> {
  // 새로운 함수형 API로 초기화
  await initializeGoogleMaps()

  const defaultOptions: google.maps.MapOptions = {
    center: DEFAULT_CENTER,
    zoom: 11,
    mapId: DEFAULT_CONFIG.mapId,
    mapTypeId: google.maps.MapTypeId.ROADMAP,
    streetViewControl: false,
    mapTypeControl: false,
    fullscreenControl: false,
    zoomControl: true,
    zoomControlOptions: {
      position: google.maps.ControlPosition.RIGHT_TOP,
    },
    gestureHandling: 'cooperative',
  }

  const finalOptions = { ...defaultOptions, ...options }

  // 새로운 API에서는 importLibrary 후 바로 google.maps 사용 가능
  return new google.maps.Map(container, finalOptions)
}

/**
 * 다크 모드 스타일 적용
 */
export function applyDarkMode(map: google.maps.Map, isDark: boolean) {
  if (map.get('mapId')) {
    return
  }

  if (isDark) {
    // Google Maps 다크 테마 스타일
    const darkStyles: google.maps.MapTypeStyle[] = [
      { elementType: 'geometry', stylers: [{ color: '#212121' }] },
      { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
      { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
      { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
      {
        featureType: 'administrative',
        elementType: 'geometry',
        stylers: [{ color: '#757575' }]
      },
      {
        featureType: 'administrative.country',
        elementType: 'labels.text.fill',
        stylers: [{ color: '#9e9e9e' }]
      },
      {
        featureType: 'road',
        elementType: 'geometry',
        stylers: [{ color: '#2c2c2c' }]
      },
      {
        featureType: 'road.highway',
        elementType: 'geometry',
        stylers: [{ color: '#3c3c3c' }]
      },
      {
        featureType: 'water',
        elementType: 'geometry',
        stylers: [{ color: '#000000' }]
      }
    ]

    map.setOptions({ styles: darkStyles })
  } else {
    // 기본 (라이트) 스타일
    map.setOptions({ styles: [] })
  }
}

/**
 * AdvancedMarkerElement 기반 마커를 생성합니다.
 */
export interface GoogleMapMarker {
  addClickListener: (handler: () => void) => google.maps.MapsEventListener
  anchor: google.maps.MVCObject | google.maps.marker.AdvancedMarkerElement
  remove: () => void
}

function createMarkerContent(icon?: string | google.maps.Icon): HTMLElement | undefined {
  if (!icon) return undefined

  const iconUrl = typeof icon === 'string' ? icon : icon.url
  if (!iconUrl) return undefined

  const wrapper = document.createElement('div')
  const image = document.createElement('img')

  image.src = iconUrl
  image.alt = ''
  image.draggable = false
  image.style.display = 'block'

  if (typeof icon !== 'string' && icon.scaledSize) {
    image.style.width = `${icon.scaledSize.width}px`
    image.style.height = `${icon.scaledSize.height}px`
  }

  wrapper.appendChild(image)
  return wrapper
}

export function createMarker(
  map: google.maps.Map,
  position: Coordinate,
  options?: Partial<google.maps.MarkerOptions>
): GoogleMapMarker {
  if (google.maps.marker?.AdvancedMarkerElement) {
    const marker = new google.maps.marker.AdvancedMarkerElement({
      map,
      position,
      title: options?.title,
      content: createMarkerContent(options?.icon as string | google.maps.Icon | undefined),
    })

    return {
      addClickListener: (handler) => {
        marker.addEventListener('gmp-click', handler)
        return {
          remove: () => marker.removeEventListener('gmp-click', handler)
        } as google.maps.MapsEventListener
      },
      anchor: marker,
      remove: () => {
        marker.map = null
      }
    }
  }

  const marker = new google.maps.Marker({
    position,
    map,
    ...options
  })

  return {
    addClickListener: (handler) => marker.addListener('click', handler),
    anchor: marker,
    remove: () => marker.setMap(null)
  }
}

/**
 * 정보창을 생성합니다
 */
export function createInfoWindow(
  content: string,
  options?: Partial<google.maps.InfoWindowOptions>
): google.maps.InfoWindow {
  return new google.maps.InfoWindow({
    content,
    ...options
  })
}

/**
 * 두 좌표 간의 거리를 계산합니다 (킬로미터)
 */
export function calculateDistance(
  point1: Coordinate,
  point2: Coordinate
): number {
  const R = 6371 // 지구 반지름 (km)
  const dLat = (point2.lat - point1.lat) * Math.PI / 180
  const dLng = (point2.lng - point1.lng) * Math.PI / 180
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

/**
 * 좌표 배열의 경계를 계산합니다
 */
export function calculateBounds(coordinates: Coordinate[]): google.maps.LatLngBounds {
  const bounds = new google.maps.LatLngBounds()
  coordinates.forEach(coord => {
    bounds.extend(new google.maps.LatLng(coord.lat, coord.lng))
  })
  return bounds
}

/**
 * 맵을 좌표 배열에 맞게 조정합니다
 */
export function fitMapToBounds(
  map: google.maps.Map,
  coordinates: Coordinate[],
  padding = 50
): void {
  if (coordinates.length === 0) return

  const bounds = calculateBounds(coordinates)
  map.fitBounds(bounds, padding)
}

export type { Coordinate, GoogleMapsConfig }
