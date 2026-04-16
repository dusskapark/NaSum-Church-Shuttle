import { createHash } from 'node:crypto'

interface ParsedRouteWaypoint {
  index: number
  name: string | null
  lat: number
  lng: number
}

interface GeocodeResult {
  placeId: string
  formattedAddress: string
  lat: number
  lng: number
  types: string[]
}

export interface RoutePathPoint {
  lat: number
  lng: number
}

export interface SyncedRouteStop {
  sequence: number
  googlePlaceId: string
  name: string
  address: string
  lat: number
  lng: number
  placeTypes: string[]
  notes: string | null
  isTerminal: boolean
  pickupTime: null
  isPickupEnabled: boolean
}

export interface ResolvedRouteUrlSnapshot {
  sourceGoogleMapsUrl: string
  resolvedGoogleMapsUrl: string
  previewPath: string
  resolvedWaypointNames: Array<string | null>
  parsedWaypoints: ParsedRouteWaypoint[]
  syncSourceHash: string
}

export interface ResolvedStopsSnapshot {
  stops: SyncedRouteStop[]
  stopsSnapshotHash: string
}

export interface PathCacheSnapshot {
  pathJson: RoutePathPoint[] | null
  pathCacheStatus: 'ready' | 'missing' | 'stale' | 'error'
  pathCacheError: string | null
  pathCacheUpdatedAt: Date | null
  pathCacheExpiresAt: Date | null
}

export interface SyncedRoutePayload {
  resolvedGoogleMapsUrl: string
  syncSourceHash: string
  resolvedStops: SyncedRouteStop[]
  stopsSnapshotHash: string
  pathSnapshot: PathCacheSnapshot
  syncStatus: 'ready' | 'error'
  syncError: string | null
}

const GOOGLE_MAPS_BASE_URL = 'https://www.google.com'
const DEFAULT_PATH_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

function decodeMapsSegment(segment: string): string {
  return decodeURIComponent(segment.replace(/\+/g, ' ')).trim()
}

function isCoordinateSegment(segment: string): boolean {
  return /^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/.test(segment)
}

function parseRouteLabel(name: string): { line: string; service: string } {
  const match = name.match(/^(.*) LINE \((.+)\)$/i)

  if (!match) {
    return { line: name.trim(), service: 'A' }
  }

  return {
    line: match[1].trim(),
    service: match[2].trim(),
  }
}

function extractPreviewDirectionsPath(html: string): string {
  const match = html.match(/<link href="([^"]*\/maps\/preview\/directions[^"]*)"/i)

  if (!match) {
    throw new Error('Unable to find Google Maps preview directions link in HTML response')
  }

  return match[1].replaceAll('&amp;', '&')
}

function parseResolvedWaypointNames(resolvedUrl: string): Array<string | null> {
  const url = new URL(resolvedUrl)
  const pathname = decodeURIComponent(url.pathname)
  const startIndex = pathname.indexOf('/maps/dir/')

  if (startIndex < 0) {
    return []
  }

  const suffix = pathname.slice(startIndex + '/maps/dir/'.length)
  const endIndex = suffix.search(/\/@|\/data=/)
  const rawSegments = (endIndex >= 0 ? suffix.slice(0, endIndex) : suffix)
    .split('/')
    .filter(Boolean)

  return rawSegments.map(segment => {
    const decoded = decodeMapsSegment(segment)
    return isCoordinateSegment(decoded) ? null : decoded
  })
}

function parsePreviewWaypoints(previewPath: string): ParsedRouteWaypoint[] {
  const previewUrl = new URL(previewPath, GOOGLE_MAPS_BASE_URL)
  const pb = previewUrl.searchParams.get('pb')

  if (!pb) {
    throw new Error('Google Maps preview payload is missing pb parameter')
  }

  const entries = [
    ...pb.matchAll(/!1m6!(?:1s|1z)([^!]+)!2s[^!]+!3m2!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)!6e\d/g),
    ...pb.matchAll(/!1m4!3m2!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)!6e\d/g),
  ]
    .map(match => {
      if (match.length === 4) {
        return {
          rawName: match[1],
          lat: match[2],
          lng: match[3],
          index: match.index ?? 0,
        }
      }

      return {
        rawName: null,
        lat: match[1],
        lng: match[2],
        index: match.index ?? 0,
      }
    })
    .sort((left, right) => left.index - right.index)

  return entries.map((entry, index) => ({
    index,
    name: entry.rawName ? decodeMapsSegment(entry.rawName) : null,
    lat: Number(entry.lat),
    lng: Number(entry.lng),
  }))
}

async function normalizeGoogleMapsUrl(googleMapsUrl: string): Promise<{ resolvedUrl: string; html: string }> {
  const response = await fetch(googleMapsUrl, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'NaSum Church Shuttle Sync/1.0',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch Google Maps URL: ${response.status} ${response.statusText}`)
  }

  return {
    resolvedUrl: response.url,
    html: await response.text(),
  }
}

async function reverseGeocodeWaypoint(
  waypoint: ParsedRouteWaypoint,
  apiKey: string
): Promise<GeocodeResult> {
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
  url.searchParams.set('latlng', `${waypoint.lat},${waypoint.lng}`)
  url.searchParams.set('key', apiKey)

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Geocoding failed for ${waypoint.lat},${waypoint.lng}: ${response.status}`)
  }

  const payload = (await response.json()) as {
    status: string
    results?: Array<{
      formatted_address: string
      place_id: string
      types: string[]
      geometry: {
        location: {
          lat: number
          lng: number
        }
      }
    }>
    error_message?: string
  }

  if (payload.status !== 'OK' || !payload.results?.length) {
    throw new Error(
      payload.error_message ??
        `Reverse geocoding returned ${payload.status} for ${waypoint.lat},${waypoint.lng}`
    )
  }

  const first = payload.results[0]

  return {
    placeId: first.place_id,
    formattedAddress: first.formatted_address,
    lat: first.geometry.location.lat,
    lng: first.geometry.location.lng,
    types: first.types,
  }
}

function buildStopsSnapshotHash(stops: SyncedRouteStop[]): string {
  return sha256(JSON.stringify(stops.map(stop => ({
    googlePlaceId: stop.googlePlaceId,
    sequence: stop.sequence,
    lat: Number(stop.lat.toFixed(6)),
    lng: Number(stop.lng.toFixed(6)),
    isTerminal: stop.isTerminal,
    isPickupEnabled: stop.isPickupEnabled,
  }))))
}

async function computeRoutePath(
  stops: SyncedRouteStop[],
  apiKey: string
): Promise<PathCacheSnapshot> {
  if (stops.length < 2) {
    return {
      pathJson: null,
      pathCacheStatus: 'missing',
      pathCacheError: 'At least two route points are required to compute a cached path.',
      pathCacheUpdatedAt: null,
      pathCacheExpiresAt: null,
    }
  }

  const [origin, ...rest] = stops
  const destination = rest[rest.length - 1]
  const intermediates = rest.slice(0, -1)

  const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'routes.polyline.encodedPolyline',
    },
    body: JSON.stringify({
      origin: {
        location: {
          latLng: {
            latitude: origin.lat,
            longitude: origin.lng,
          },
        },
      },
      destination: {
        location: {
          latLng: {
            latitude: destination.lat,
            longitude: destination.lng,
          },
        },
      },
      intermediates: intermediates.map(stop => ({
        location: {
          latLng: {
            latitude: stop.lat,
            longitude: stop.lng,
          },
        },
      })),
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_UNAWARE',
      polylineQuality: 'OVERVIEW',
    }),
  })

  if (!response.ok) {
    throw new Error(`Routes API compute failed: ${response.status} ${response.statusText}`)
  }

  const payload = (await response.json()) as {
    routes?: Array<{
      polyline?: {
        encodedPolyline?: string
      }
    }>
  }

  const encodedPolyline = payload.routes?.[0]?.polyline?.encodedPolyline

  if (!encodedPolyline) {
    throw new Error('Routes API response did not include an encoded polyline.')
  }

  const pathJson = decodeEncodedPolyline(encodedPolyline)
  const updatedAt = new Date()

  return {
    pathJson,
    pathCacheStatus: 'ready',
    pathCacheError: null,
    pathCacheUpdatedAt: updatedAt,
    pathCacheExpiresAt: new Date(updatedAt.getTime() + DEFAULT_PATH_CACHE_TTL_MS),
  }
}

function decodeEncodedPolyline(encoded: string): RoutePathPoint[] {
  let index = 0
  let lat = 0
  let lng = 0
  const coordinates: RoutePathPoint[] = []

  while (index < encoded.length) {
    let result = 0
    let shift = 0
    let byte: number

    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)

    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1
    lat += deltaLat

    result = 0
    shift = 0

    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)

    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1
    lng += deltaLng

    coordinates.push({
      lat: lat / 1e5,
      lng: lng / 1e5,
    })
  }

  return coordinates
}

export async function resolveRouteUrl(googleMapsUrl: string): Promise<ResolvedRouteUrlSnapshot> {
  const { resolvedUrl, html } = await normalizeGoogleMapsUrl(googleMapsUrl)
  const previewPath = extractPreviewDirectionsPath(html)
  const resolvedWaypointNames = parseResolvedWaypointNames(resolvedUrl)
  const parsedWaypoints = parsePreviewWaypoints(previewPath)

  return {
    sourceGoogleMapsUrl: googleMapsUrl,
    resolvedGoogleMapsUrl: resolvedUrl,
    previewPath,
    resolvedWaypointNames,
    parsedWaypoints,
    syncSourceHash: sha256(`${googleMapsUrl}|${resolvedUrl}|${previewPath}`),
  }
}

export async function resolveStopsAndPlaces(
  routeSnapshot: ResolvedRouteUrlSnapshot,
  apiKey: string
): Promise<ResolvedStopsSnapshot> {
  const geocodeCache = new Map<string, GeocodeResult>()
  const stops: SyncedRouteStop[] = []

  for (const waypoint of routeSnapshot.parsedWaypoints) {
    const cacheKey = `${waypoint.lat.toFixed(6)},${waypoint.lng.toFixed(6)}`
    let geocode = geocodeCache.get(cacheKey)

    if (!geocode) {
      geocode = await reverseGeocodeWaypoint(waypoint, apiKey)
      geocodeCache.set(cacheKey, geocode)
    }

    stops.push({
      sequence: waypoint.index + 1,
      googlePlaceId: geocode.placeId,
      name: routeSnapshot.resolvedWaypointNames[waypoint.index] ?? waypoint.name ?? geocode.formattedAddress,
      address: geocode.formattedAddress,
      lat: geocode.lat,
      lng: geocode.lng,
      placeTypes: geocode.types,
      notes: null,
      isTerminal: waypoint.index === routeSnapshot.parsedWaypoints.length - 1,
      pickupTime: null,
      isPickupEnabled: waypoint.index !== routeSnapshot.parsedWaypoints.length - 1,
    })
  }

  return {
    stops,
    stopsSnapshotHash: buildStopsSnapshotHash(stops),
  }
}

export async function computeAndCachePath(
  stops: SyncedRouteStop[],
  apiKey: string
): Promise<PathCacheSnapshot> {
  try {
    return await computeRoutePath(stops, apiKey)
  } catch (error) {
    return {
      pathJson: null,
      pathCacheStatus: 'error',
      pathCacheError: error instanceof Error ? error.message : String(error),
      pathCacheUpdatedAt: null,
      pathCacheExpiresAt: null,
    }
  }
}

export async function syncRouteFromGoogleMapsUrl(
  googleMapsUrl: string,
  apiKey: string
): Promise<SyncedRoutePayload> {
  const routeSnapshot = await resolveRouteUrl(googleMapsUrl)
  const stopsSnapshot = await resolveStopsAndPlaces(routeSnapshot, apiKey)
  const pathSnapshot = await computeAndCachePath(stopsSnapshot.stops, apiKey)

  return {
    resolvedGoogleMapsUrl: routeSnapshot.resolvedGoogleMapsUrl,
    syncSourceHash: routeSnapshot.syncSourceHash,
    resolvedStops: stopsSnapshot.stops,
    stopsSnapshotHash: stopsSnapshot.stopsSnapshotHash,
    pathSnapshot,
    syncStatus: 'ready',
    syncError: null,
  }
}

export { decodeEncodedPolyline, parseRouteLabel }
