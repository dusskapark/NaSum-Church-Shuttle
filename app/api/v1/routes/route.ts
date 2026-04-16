import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/server/db';
import { json } from '@/server/http';

export const dynamic = 'force-dynamic';

interface RouteRow {
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

interface StopRow {
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

async function fetchRouteStops(routeIds: string[]) {
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

export async function GET(request: NextRequest) {
  const routeRows = await query<RouteRow>(
    `SELECT id, route_code, name, display_name, line, service, revision,
            google_maps_url, path_json, path_cache_status,
            path_cache_updated_at, path_cache_expires_at, path_cache_error, active
     FROM routes
     WHERE active = true
     ORDER BY line ASC, service ASC, revision ASC`,
  );

  if (routeRows.length === 0) {
    const etag = createHash('sha1').update('[]').digest('hex');
    const response = json([], { status: 200 });
    response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=600');
    response.headers.set('ETag', `W/"${etag}"`);
    return response;
  }

  const stopRows = await fetchRouteStops(routeRows.map((route) => route.id));
  const stopsByRouteId = new Map<string, unknown[]>();

  stopRows.forEach((stop) => {
    const routeStop = {
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
    const list = stopsByRouteId.get(stop.route_id) ?? [];
    list.push(routeStop);
    stopsByRouteId.set(stop.route_id, list);
  });

  const payload = routeRows.map((route) => ({
    ...route,
    stops: stopsByRouteId.get(route.id) ?? [],
    cachedPath: toCachedPath(route.path_json),
    pathCacheStatus: route.path_cache_status ?? 'missing',
    pathCacheUpdatedAt: route.path_cache_updated_at?.toISOString() ?? null,
    pathCacheExpiresAt: route.path_cache_expires_at?.toISOString() ?? null,
    pathCacheError: route.path_cache_error ?? null,
  }));

  const serialized = JSON.stringify(payload);
  const etag = `W/"${createHash('sha1').update(serialized).digest('hex')}"`;
  if (request.headers.get('if-none-match') === etag) {
    return new NextResponse(null, { status: 304 });
  }

  const response = json(payload);
  response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=600');
  response.headers.set('ETag', etag);
  return response;
}
