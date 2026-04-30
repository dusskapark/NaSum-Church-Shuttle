import { NextRequest } from 'next/server';
import { queryOne } from '@/server/db';
import { getActor, json, error } from '@/server/http';
import { buildStopStatesForRoute, fetchRouteStops, type RouteRow, type RunRow } from '../_shared';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const routeCode = request.nextUrl.searchParams.get('routeCode');
  if (!routeCode) return error(400, 'routeCode is required');

  const route = await queryOne<RouteRow>(
    `SELECT id, route_code, name, display_name, line, service, revision,
            google_maps_url, path_json, path_cache_status,
            path_cache_updated_at, path_cache_expires_at, path_cache_error, active
     FROM routes WHERE route_code = $1 AND active = true`,
    [routeCode],
  );
  if (!route) return error(404, 'Route not found');

  const run = await queryOne<RunRow>(
    `SELECT * FROM shuttle_runs
     WHERE route_id = $1 AND status = 'active'
     ORDER BY started_at DESC NULLS LAST
     LIMIT 1`,
    [route.id],
  );
  if (!run) return error(404, 'No active run for this route');

  const stopRows = await fetchRouteStops([route.id]);
  const stopStates = await buildStopStatesForRoute(
    run.id,
    stopRows.map((stop) => stop.id),
  );

  const actor = await getActor(request);
  let myCheckin: {
    checkin_id: string;
    route_stop_id: string;
    stop_state: {
      route_stop_id: string;
      total_passengers: number;
      status: 'arrived';
    };
  } | null = null;

  if (actor) {
    const idempotencyKey = `${actor.userId}:${run.id}`;
    const existingCheckin = await queryOne<{ id: string; route_stop_id: string }>(
      `SELECT id, route_stop_id FROM scan_events WHERE idempotency_key = $1`,
      [idempotencyKey],
    );

    if (existingCheckin) {
      const count = await queryOne<{ total: bigint | number }>(
        `SELECT COALESCE(SUM(1 + additional_passengers), 0) AS total
           FROM scan_events WHERE run_id = $1 AND route_stop_id = $2`,
        [run.id, existingCheckin.route_stop_id],
      );

      myCheckin = {
        checkin_id: existingCheckin.id,
        route_stop_id: existingCheckin.route_stop_id,
        stop_state: {
          route_stop_id: existingCheckin.route_stop_id,
          total_passengers: Number(count?.total ?? 0),
          status: 'arrived',
        },
      };
    }
  }

  return json({
    run,
    route: {
      ...route,
      stops: stopRows.map((stop) => ({
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
          lat: stop.lat,
          lng: stop.lng,
          place_types: stop.place_types ?? [],
          notes: stop.place_notes,
          is_terminal: stop.is_terminal,
          stop_id: stop.stop_id,
        },
      })),
    },
    stop_states: stopStates,
    my_checkin: myCheckin,
  });
}
