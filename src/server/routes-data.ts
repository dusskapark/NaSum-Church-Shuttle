import { query, queryOne } from './db';

export interface RouteRow {
  id: string;
  route_code: string;
  name: string | null;
  display_name: string | null;
  line: string;
  service: string;
  revision: number;
  google_maps_url: string | null;
  path_json: unknown;
  path_cache_status: string | null;
  path_cache_updated_at: Date | null;
  path_cache_expires_at: Date | null;
  path_cache_error: string | null;
  active: boolean;
}

export interface StopRow {
  id: string;
  route_id: string;
  place_id: string;
  sequence: number;
  pickup_time: string | null;
  notes: string | null;
  is_pickup_enabled: boolean;
  address: string | null;
  formatted_address: string | null;
  google_place_id: string;
  place_name: string;
  place_display_name: string | null;
  primary_type: string | null;
  primary_type_display_name: string | null;
  lat: number;
  lng: number;
  place_types: string[];
  place_notes: string | null;
  is_terminal: boolean;
  stop_id: string | null;
}

export interface RouteSummaryRow {
  id: string;
  route_code: string;
  name: string | null;
  display_name: string | null;
  line: string;
  service: string;
  revision: number;
  google_maps_url: string | null;
  active: boolean;
  visible_stop_count: number;
}

export interface PlaceSummaryRow {
  google_place_id: string;
  name: string;
  display_name: string | null;
  lat: number;
  lng: number;
  is_terminal: boolean;
}

function isRoutePathPoint(value: unknown): value is { lat: number; lng: number } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { lat?: unknown }).lat === 'number' &&
    typeof (value as { lng?: unknown }).lng === 'number'
  );
}

function toCachedPath(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter(isRoutePathPoint);
}

export function mapStopRow(stop: StopRow) {
  return {
    id: stop.id,
    route_id: stop.route_id,
    place_id: stop.place_id,
    sequence: stop.sequence,
    pickup_time: stop.pickup_time,
    notes: stop.notes,
    is_pickup_enabled: stop.is_pickup_enabled,
    place: {
      id: stop.place_id,
      google_place_id: stop.google_place_id,
      name: stop.place_name,
      display_name: stop.place_display_name,
      address: stop.address,
      formatted_address: stop.formatted_address,
      primary_type: stop.primary_type,
      primary_type_display_name: stop.primary_type_display_name,
      lat: Number(stop.lat),
      lng: Number(stop.lng),
      place_types: stop.place_types ?? [],
      notes: stop.place_notes,
      is_terminal: stop.is_terminal,
      stop_id: stop.stop_id,
    },
  };
}

export function mapRouteDetail(route: RouteRow, stops: StopRow[]) {
  return {
    ...route,
    stops: stops.map(mapStopRow),
    cachedPath: toCachedPath(route.path_json),
    pathCacheStatus: route.path_cache_status ?? 'missing',
    pathCacheUpdatedAt: route.path_cache_updated_at?.toISOString() ?? null,
    pathCacheExpiresAt: route.path_cache_expires_at?.toISOString() ?? null,
    pathCacheError: route.path_cache_error ?? null,
  };
}

export async function fetchRouteStops(routeIds: string[]) {
  if (routeIds.length === 0) return [];
  const placeholders = routeIds.map((_, index) => `$${index + 1}`).join(',');
  return query<StopRow>(
    `SELECT
       rs.id, rs.route_id, rs.place_id, rs.sequence,
       rs.pickup_time, rs.notes, rs.is_pickup_enabled,
       p.address, p.formatted_address, p.google_place_id,
       p.name AS place_name, p.display_name AS place_display_name,
       p.primary_type, p.primary_type_display_name,
       p.lat, p.lng, p.place_types, p.notes AS place_notes, p.is_terminal, p.stop_id
     FROM route_stops rs
     JOIN places p ON p.id = rs.place_id
     WHERE rs.route_id IN (${placeholders}) AND rs.active = true
     ORDER BY rs.sequence ASC`,
    routeIds,
  );
}

export async function fetchRouteSummaries() {
  return query<RouteSummaryRow>(
    `SELECT
       r.id,
       r.route_code,
       r.name,
       r.display_name,
       r.line,
       r.service,
       r.revision,
       r.google_maps_url,
       r.active,
       COUNT(p.id)::int AS visible_stop_count
     FROM routes r
     LEFT JOIN route_stops rs
       ON rs.route_id = r.id
      AND rs.active = true
      AND rs.is_pickup_enabled = true
     LEFT JOIN places p
       ON p.id = rs.place_id
      AND p.is_terminal = false
     WHERE r.active = true
     GROUP BY
       r.id,
       r.route_code,
       r.name,
       r.display_name,
       r.line,
       r.service,
       r.revision,
       r.google_maps_url,
       r.active
     ORDER BY r.line ASC, r.service ASC, r.revision ASC`,
  );
}

export async function fetchRouteByCode(routeCode: string) {
  return queryOne<RouteRow>(
    `SELECT id, route_code, name, display_name, line, service, revision,
            google_maps_url, path_json, path_cache_status,
            path_cache_updated_at, path_cache_expires_at, path_cache_error, active
     FROM routes
     WHERE route_code = $1 AND active = true`,
    [routeCode],
  );
}

export async function fetchRouteDetailByCode(routeCode: string) {
  const route = await fetchRouteByCode(routeCode);
  if (!route) return null;
  const stops = await fetchRouteStops([route.id]);
  return mapRouteDetail(route, stops);
}

export async function fetchPlaceSummaries() {
  const rows = await query<PlaceSummaryRow>(
    `SELECT DISTINCT ON (p.google_place_id)
       p.google_place_id,
       p.name,
       p.display_name,
       p.lat,
       p.lng,
       p.is_terminal
     FROM route_stops rs
     JOIN routes r ON r.id = rs.route_id
     JOIN places p ON p.id = rs.place_id
     WHERE r.active = true
       AND rs.active = true
       AND rs.is_pickup_enabled = true
       AND p.is_terminal = false
     ORDER BY p.google_place_id, COALESCE(NULLIF(p.display_name, ''), p.name) ASC`,
  );

  return rows
    .map((row) => ({
      googlePlaceId: row.google_place_id,
      name: row.display_name?.trim() || row.name,
      lat: Number(row.lat),
      lng: Number(row.lng),
      isTerminal: row.is_terminal,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function fetchPlaceRouteCandidates(googlePlaceId: string) {
  const rows = await query<StopRow & Pick<RouteRow, 'route_code' | 'name' | 'display_name' | 'line' | 'service' | 'google_maps_url'>>(
    `SELECT
       rs.id, rs.route_id, rs.place_id, rs.sequence,
       rs.pickup_time, rs.notes, rs.is_pickup_enabled,
       p.address, p.formatted_address, p.google_place_id,
       p.name AS place_name, p.display_name AS place_display_name,
       p.primary_type, p.primary_type_display_name,
       p.lat, p.lng, p.place_types, p.notes AS place_notes, p.is_terminal, p.stop_id,
       r.route_code, r.name, r.display_name, r.line, r.service, r.google_maps_url
     FROM route_stops rs
     JOIN routes r ON r.id = rs.route_id
     JOIN places p ON p.id = rs.place_id
     WHERE p.google_place_id = $1
       AND r.active = true
       AND rs.active = true
       AND rs.is_pickup_enabled = true
       AND p.is_terminal = false
     ORDER BY r.line ASC, r.service ASC, r.route_code ASC, rs.sequence ASC`,
    [googlePlaceId],
  );

  if (rows.length === 0) {
    return {
      sourceStop: null,
      matchingStops: [],
    };
  }

  const source = rows[0];
  const sourceStop = {
    googlePlaceId: source.google_place_id,
    name: source.place_display_name?.trim() || source.place_name,
    lat: Number(source.lat),
    lng: Number(source.lng),
    isTerminal: source.is_terminal,
    routeStopId: source.id,
    routeCode: source.route_code,
    routeLabel:
      source.display_name?.trim() ||
      source.name?.trim() ||
      `${source.line} LINE (${source.service})`,
    stopOrder: source.sequence,
    pickupTime: source.pickup_time,
    notes: source.notes,
    googleMapsUrl: source.google_maps_url,
    address: source.address,
    formattedAddress: source.formatted_address,
    primaryTypeDisplayName: source.primary_type_display_name,
    stopId: source.stop_id ?? null,
  };

  const matchingStops = rows.map((row) => ({
    googlePlaceId: row.google_place_id,
    name: row.place_display_name?.trim() || row.place_name,
    lat: Number(row.lat),
    lng: Number(row.lng),
    isTerminal: row.is_terminal,
    routeStopId: row.id,
    routeCode: row.route_code,
    routeLabel:
      row.display_name?.trim() ||
      row.name?.trim() ||
      `${row.line} LINE (${row.service})`,
    stopOrder: row.sequence,
    pickupTime: row.pickup_time,
    notes: row.notes,
    googleMapsUrl: row.google_maps_url,
    address: row.address,
    formattedAddress: row.formatted_address,
    primaryTypeDisplayName: row.primary_type_display_name,
    stopId: row.stop_id ?? null,
  }));

  return {
    sourceStop,
    matchingStops,
  };
}
