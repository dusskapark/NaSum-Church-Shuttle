import type {
  Nullable,
  RouteWithStations,
  Station,
  StopCandidate,
} from './types'

export interface Coordinates {
  lat: number
  lng: number
}

type RouteSummary = {
  line: string
  service: string
}

type StationGroups = Record<string, Station[]>

export function getRouteLabel(route: RouteSummary): string {
  return `${route.line} LINE (${route.service})`
}

export function getVisibleStations(route?: Nullable<RouteWithStations>): Station[] {
  return (route?.stations ?? []).filter(station => !station.is_terminal)
}

export function getUniqueStations(routes: RouteWithStations[]): Station[] {
  return Array.from(
    routes
      .flatMap(route => getVisibleStations(route))
      .reduce<Map<string, Station>>((accumulator, station) => {
        if (!accumulator.has(station.name)) {
          accumulator.set(station.name, station)
        }

        return accumulator
      }, new Map())
  )
    .map(([, station]) => station)
    .sort((left, right) => left.name.localeCompare(right.name))
}

export function filterStationsByKeyword(stations: Station[], keyword: string): Station[] {
  const normalizedKeyword = keyword.trim().toLowerCase()

  if (!normalizedKeyword) {
    return stations
  }

  return stations.filter(station => station.name.toLowerCase().includes(normalizedKeyword))
}

export function getStationIndex(name: string): string {
  const firstChar = name.trim().charAt(0).toUpperCase()
  return /[A-Z]/.test(firstChar) ? firstChar : '#'
}

export function groupStationsByIndex(stations: Station[]): StationGroups {
  return stations.reduce<StationGroups>((accumulator, station) => {
    const index = getStationIndex(station.name)

    if (!accumulator[index]) {
      accumulator[index] = []
    }

    accumulator[index].push(station)
    return accumulator
  }, {})
}

export function sortStationIndexes(groups: StationGroups): string[] {
  return Object.keys(groups).sort((left, right) => {
    if (left === '#') return 1
    if (right === '#') return -1
    return left.localeCompare(right)
  })
}

export function getDistanceInKm(from: Coordinates, to: Coordinates): number {
  const earthRadiusKm = 6371
  const dLat = ((to.lat - from.lat) * Math.PI) / 180
  const dLng = ((to.lng - from.lng) * Math.PI) / 180
  const lat1 = (from.lat * Math.PI) / 180
  const lat2 = (to.lat * Math.PI) / 180

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2)

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function sortStationsByDistance(
  stations: Station[],
  coordinates: Nullable<Coordinates>
): Station[] {
  if (!coordinates) {
    return stations
  }

  return [...stations].sort((left, right) => {
    const leftDistance = getDistanceInKm(coordinates, { lat: left.lat, lng: left.lng })
    const rightDistance = getDistanceInKm(coordinates, { lat: right.lat, lng: right.lng })

    if (leftDistance === rightDistance) {
      return left.name.localeCompare(right.name)
    }

    return leftDistance - rightDistance
  })
}

export function getStopCandidates(routes: RouteWithStations[]): StopCandidate[] {
  return routes.flatMap(route =>
    getVisibleStations(route).map((station, index) => ({
      ...station,
      routeId: route.id,
      routeLabel: getRouteLabel(route),
      stopOrder: index + 1,
      google_maps_url: route.google_maps_url,
    }))
  )
}

export function getSourceStop(
  allStops: StopCandidate[],
  stationId: Nullable<string>
): Nullable<StopCandidate> {
  if (!stationId) {
    return null
  }

  return allStops.find(stop => stop.id === stationId) ?? null
}

export function getMatchingStops(
  allStops: StopCandidate[],
  sourceStop: Nullable<StopCandidate>
): StopCandidate[] {
  if (!sourceStop) {
    return []
  }

  return allStops.filter(stop => stop.name === sourceStop.name)
}
