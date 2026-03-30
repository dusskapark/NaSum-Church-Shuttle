/**
 * 도로 경로를 가져오기 위한 routing 유틸리티
 * OpenRouteService API를 사용합니다 (무료)
 */

interface Coordinate {
  lng: number
  lat: number
}

interface OSRMRouteResponse {
  routes: Array<{
    geometry: {
      coordinates: Array<[number, number]>
    }
  }>
}

/**
 * 두 지점 사이의 도로 경로를 가져옵니다
 * OSRM 공개 인스턴스를 사용합니다 (무료)
 */
export async function getRouteCoordinates(
  start: Coordinate,
  end: Coordinate
): Promise<Array<[number, number]> | null> {
  try {
    // OSRM 공개 API 사용 (무료, API 키 불필요)
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`,
      {
        headers: {
          'Accept': 'application/json',
        }
      }
    )

    if (!response.ok) {
      console.warn('OSRM routing API failed, falling back to straight line')
      return [[start.lng, start.lat], [end.lng, end.lat]]
    }

    const data = await response.json()

    if (data.routes?.[0]?.geometry?.coordinates) {
      return data.routes[0].geometry.coordinates
    }

    return [[start.lng, start.lat], [end.lng, end.lat]]
  } catch (error) {
    console.warn('Failed to fetch route:', error)
    // 실패 시 직선으로 fallback
    return [[start.lng, start.lat], [end.lng, end.lat]]
  }
}

/**
 * 여러 정류장을 거쳐가는 전체 루트를 생성합니다
 */
export async function createBusRoute(
  stations: Coordinate[],
  finalDestination: Coordinate
): Promise<Array<[number, number]>> {
  if (stations.length === 0) {
    return []
  }

  const allCoordinates: Array<[number, number]> = []
  const waypoints = [...stations, finalDestination]

  // 각 구간별로 도로 경로 가져오기
  for (let i = 0; i < waypoints.length - 1; i++) {
    const start = waypoints[i]
    const end = waypoints[i + 1]

    const segmentCoords = await getRouteCoordinates(start, end)

    if (segmentCoords) {
      // 첫 번째 구간이 아니면 시작점 제외 (중복 방지)
      const coordsToAdd = i === 0 ? segmentCoords : segmentCoords.slice(1)
      allCoordinates.push(...coordsToAdd)
    }

    // API 호출 간격 조절 (rate limiting 방지)
    if (i < waypoints.length - 2) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  return allCoordinates
}