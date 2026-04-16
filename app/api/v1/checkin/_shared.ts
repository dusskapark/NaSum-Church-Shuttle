import { query } from '@/server/db';

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

export interface RunRow {
  id: string;
  route_id: string;
  service_date: string;
  status: 'scheduled' | 'active' | 'completed';
  started_at: string | null;
  ended_at: string | null;
  created_mode: 'manual' | 'auto';
  created_by: string | null;
  ended_mode: 'manual' | 'auto' | null;
  ended_by: string | null;
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

async function getStopStates(runId: string) {
  const rows = await query<{ route_stop_id: string; total_passengers: bigint | number }>(
    `SELECT se.route_stop_id,
            COALESCE(SUM(1 + se.additional_passengers), 0) AS total_passengers
     FROM scan_events se
     WHERE se.run_id = $1
     GROUP BY se.route_stop_id`,
    [runId],
  );

  return rows.map((row) => ({
    route_stop_id: row.route_stop_id,
    total_passengers: Number(row.total_passengers),
    status: 'arrived' as const,
  }));
}

export async function buildStopStatesForRoute(runId: string, routeStopIds: string[]) {
  const arrived = await getStopStates(runId);
  const arrivedMap = new Map(arrived.map((stop) => [stop.route_stop_id, stop]));
  const overrideRows = await query<{
    route_stop_id: string;
    status: 'waiting' | 'arrived';
    total_passengers_override: number | null;
  }>(
    `SELECT route_stop_id, status, total_passengers_override
     FROM admin_stop_overrides WHERE run_id = $1`,
    [runId],
  );
  const overrideMap = new Map(overrideRows.map((row) => [row.route_stop_id, row]));

  return routeStopIds.map((routeStopId) => {
    const natural =
      arrivedMap.get(routeStopId) ?? {
        route_stop_id: routeStopId,
        total_passengers: 0,
        status: 'waiting' as const,
      };
    const override = overrideMap.get(routeStopId);
    if (!override) return natural;
    return {
      ...natural,
      status: override.status,
      total_passengers: override.total_passengers_override ?? natural.total_passengers,
    };
  });
}
