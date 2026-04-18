import { logDebug, logError } from '@/lib/logger';

const PLACES_API_BASE = 'https://places.googleapis.com/v1';

const SEARCH_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.types',
  'places.primaryType',
  'places.primaryTypeDisplayName',
].join(',');

const DETAILS_FIELD_MASK = [
  'id',
  'displayName',
  'formattedAddress',
  'location',
  'types',
  'primaryType',
  'primaryTypeDisplayName',
].join(',');

const SHORT_URL_HOSTS = ['maps.app.goo.gl', 'goo.gl'];

export interface PlaceResult {
  googlePlaceId: string;
  name: string;
  formattedAddress: string | null;
  lat: number;
  lng: number;
  primaryType: string | null;
  primaryTypeDisplayName: string | null;
  types: string[];
}

export interface WaypointInfo {
  raw: string;
  placeId?: string;
}

interface PlacesApiPlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  primaryType?: string;
  primaryTypeDisplayName?: { text?: string };
  types?: string[];
}

function isBusStopPlace(place: PlaceResult): boolean {
  return place.primaryType === 'bus_stop' || place.types.includes('bus_stop');
}

function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusMeters = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function resolveUrl(url: string): Promise<string> {
  let current = url;

  for (let i = 0; i < 5; i += 1) {
    const parsed = new URL(current);
    if (!SHORT_URL_HOSTS.includes(parsed.hostname)) return current;

    const res = await fetch(current, { method: 'HEAD', redirect: 'manual' });
    const location = res.headers.get('location');
    if (!location) {
      throw new Error(
        `Short URL could not be resolved. Use a full Google Maps directions URL. (${current})`,
      );
    }

    logDebug(`[google-places] resolveUrl: ${current} -> ${location}`);
    current = location;
  }

  return current;
}

function parseWaypointString(raw: string): WaypointInfo {
  if (raw.startsWith('place_id:')) {
    return { raw, placeId: raw.slice('place_id:'.length) };
  }
  return { raw };
}

function parseDataSegmentCoords(
  dataSegment: string,
  pathCount: number,
): Array<{ lat: number; lng: number }> {
  const coordPattern = /!2m2!1d(-?\d+(?:\.\d+)?)!2d(-?\d+(?:\.\d+)?)/g;
  const coords: Array<{ lat: number; lng: number }> = [];
  let match: RegExpExecArray | null;

  while ((match = coordPattern.exec(dataSegment)) !== null) {
    coords.push({ lat: Number(match[2]), lng: Number(match[1]) });
  }

  logDebug(
    `[google-places] data= coords found: ${coords.length}, path segments: ${pathCount}, extra: ${Math.max(0, coords.length - pathCount)}`,
  );

  return coords.slice(pathCount);
}

export async function parseGoogleMapsUrl(url: string): Promise<WaypointInfo[]> {
  const resolved = await resolveUrl(url);
  logDebug(`[google-places] resolveUrl final: ${url} -> ${resolved}`);

  const parsed = new URL(resolved);

  if (
    parsed.searchParams.has('origin') ||
    parsed.searchParams.has('destination')
  ) {
    const waypoints: WaypointInfo[] = [];
    const origin = parsed.searchParams.get('origin');
    const destination = parsed.searchParams.get('destination');
    const mid = parsed.searchParams.get('waypoints');

    if (origin) waypoints.push(parseWaypointString(origin));
    if (mid) {
      waypoints.push(...mid.split('|').filter(Boolean).map(parseWaypointString));
    }
    if (destination) waypoints.push(parseWaypointString(destination));

    logDebug(
      `[google-places] query-param format -> ${waypoints.length} waypoints`,
      waypoints.map((w) => w.raw),
    );
    return waypoints;
  }

  const dirMatch = parsed.pathname.match(/\/maps\/dir\/(.+)/);
  if (!dirMatch) {
    throw new Error(`Unrecognized Google Maps URL format: ${url}`);
  }

  const allSegments = dirMatch[1]
    .split('/')
    .map((segment) => decodeURIComponent(segment.replace(/\+/g, ' ')).trim());

  const dataSegment = allSegments.find((segment) => segment.startsWith('data='));
  const segments = allSegments.filter(
    (segment) =>
      segment.length > 0 &&
      segment !== '@' &&
      !segment.startsWith('@') &&
      !segment.startsWith('data=') &&
      !segment.startsWith('data:') &&
      !segment.startsWith('am5:'),
  );

  if (dataSegment) {
    const extraCoords = parseDataSegmentCoords(dataSegment, segments.length);
    if (extraCoords.length > 0) {
      logDebug(
        `[google-places] data= extra waypoint coords: ${extraCoords.length}`,
        extraCoords,
      );
      segments.push(...extraCoords.map((coord) => `${coord.lat},${coord.lng}`));
    }
  }

  logDebug(
    `[google-places] path format -> ${segments.length} waypoints`,
    segments,
  );

  return segments.map(parseWaypointString);
}

function placesHeaders(apiKey: string, fieldMask: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': apiKey,
    'X-Goog-FieldMask': fieldMask,
  };
}

function mapApiPlace(place: PlacesApiPlace): PlaceResult | null {
  if (!place.id || !place.location?.latitude || !place.location.longitude) {
    return null;
  }

  return {
    googlePlaceId: place.id,
    name: place.displayName?.text ?? '',
    formattedAddress: place.formattedAddress ?? null,
    lat: place.location.latitude,
    lng: place.location.longitude,
    primaryType: place.primaryType ?? null,
    primaryTypeDisplayName: place.primaryTypeDisplayName?.text ?? null,
    types: place.types ?? [],
  };
}

export async function getPlaceById(
  placeId: string,
  apiKey: string,
): Promise<PlaceResult | null> {
  const res = await fetch(`${PLACES_API_BASE}/places/${placeId}`, {
    headers: placesHeaders(apiKey, DETAILS_FIELD_MASK),
  });

  if (!res.ok) {
    logError(
      `[google-places] getPlaceById failed (${res.status})`,
      await res.text().catch(() => ''),
    );
    return null;
  }

  const data = (await res.json()) as PlacesApiPlace;
  return mapApiPlace(data);
}

async function searchPlace(
  query: string,
  apiKey: string,
): Promise<PlaceResult | null> {
  const res = await fetch(`${PLACES_API_BASE}/places:searchText`, {
    method: 'POST',
    headers: placesHeaders(apiKey, SEARCH_FIELD_MASK),
    body: JSON.stringify({ textQuery: query }),
  });

  if (!res.ok) {
    logError(
      `[google-places] searchText failed (${res.status})`,
      await res.text().catch(() => ''),
    );
    return null;
  }

  const data = (await res.json()) as { places?: PlacesApiPlace[] };
  const first = data.places?.[0];
  if (!first) return null;
  return mapApiPlace(first);
}

async function searchNearby(
  lat: number,
  lng: number,
  apiKey: string,
  options?: { radius?: number; includedTypes?: string[] },
): Promise<PlaceResult | null> {
  const res = await fetch(`${PLACES_API_BASE}/places:searchNearby`, {
    method: 'POST',
    headers: placesHeaders(apiKey, SEARCH_FIELD_MASK),
    body: JSON.stringify({
      maxResultCount: 1,
      rankPreference: 'DISTANCE',
      ...(options?.includedTypes ? { includedTypes: options.includedTypes } : {}),
      locationRestriction: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: options?.radius ?? 150,
        },
      },
    }),
  });

  if (!res.ok) {
    logError(
      `[google-places] searchNearby failed (${res.status})`,
      await res.text().catch(() => ''),
    );
    return null;
  }

  const data = (await res.json()) as { places?: PlacesApiPlace[] };
  const first = data.places?.[0];
  if (!first) return null;
  return mapApiPlace(first);
}

async function searchNearbyBusStop(
  lat: number,
  lng: number,
  apiKey: string,
): Promise<PlaceResult | null> {
  return searchNearby(lat, lng, apiKey, {
    radius: 600,
    includedTypes: ['bus_stop'],
  });
}

async function preferNearbyBusStop(
  place: PlaceResult | null,
  apiKey: string,
): Promise<PlaceResult | null> {
  if (!place || isBusStopPlace(place)) return place;

  const busStop = await searchNearbyBusStop(place.lat, place.lng, apiKey);
  if (!busStop) return place;

  const distance = distanceMeters(place.lat, place.lng, busStop.lat, busStop.lng);
  if (distance > 700) return place;

  logDebug(
    `[google-places] normalize to bus_stop: ${place.googlePlaceId} -> ${busStop.googlePlaceId} (${Math.round(distance)}m)`,
  );
  return busStop;
}

export async function resolveWaypoint(
  waypoint: WaypointInfo,
  apiKey: string,
): Promise<PlaceResult | null> {
  if (waypoint.placeId) {
    const place = await getPlaceById(waypoint.placeId, apiKey);
    return preferNearbyBusStop(place, apiKey);
  }

  const coordMatch = waypoint.raw
    .trim()
    .match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
  if (coordMatch) {
    const lat = Number(coordMatch[1]);
    const lng = Number(coordMatch[2]);
    logDebug(
      `[google-places] coordinate waypoint via nearby search: ${waypoint.raw}`,
    );
    const busStop = await searchNearbyBusStop(lat, lng, apiKey);
    if (busStop) return busStop;
    return searchNearby(lat, lng, apiKey);
  }

  const place = await searchPlace(waypoint.raw, apiKey);
  return preferNearbyBusStop(place, apiKey);
}
