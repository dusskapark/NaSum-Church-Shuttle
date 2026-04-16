import { NextRequest } from 'next/server';
import { query, queryOne } from '@/server/db';
import { json, error } from '@/server/http';
import { buildStopStatesForRoute, type RunRow } from '../_shared';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const routeCode = request.nextUrl.searchParams.get('routeCode');
  if (!routeCode) return error(400, 'routeCode is required');

  const route = await queryOne<{ id: string; route_code: string }>(
    `SELECT id, route_code FROM routes WHERE route_code = $1 AND active = true`,
    [routeCode],
  );
  if (!route) return json(null);

  const run = await queryOne<RunRow>(
    `SELECT * FROM shuttle_runs
     WHERE route_id = $1 AND status = 'active'
     ORDER BY started_at DESC NULLS LAST
     LIMIT 1`,
    [route.id],
  );
  if (!run) return json(null);

  const stopIds = await query<{ id: string }>(
    `SELECT id FROM route_stops WHERE route_id = $1 AND active = true ORDER BY sequence ASC`,
    [route.id],
  );

  const stopStates = await buildStopStatesForRoute(
    run.id,
    stopIds.map((stop) => stop.id),
  );

  return json({
    run_id: run.id,
    route_id: run.route_id,
    route_code: route.route_code,
    started_at: run.started_at ?? new Date().toISOString(),
    stop_states: stopStates,
  });
}
