import { randomUUID } from 'node:crypto';
import { query, queryOne, withTransaction } from './db';
import { mapRouteDetail, type RouteRow, type StopRow } from './routes-data';

interface RegistrationRow {
  id: string;
  user_id: string;
  route_id: string;
  route_stop_id: string;
  status: string;
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

export async function fetchRouteWithStops(routeId: string) {
  const routeRow = await queryOne<RouteRow>(
    `SELECT id, route_code, name, display_name, line, service, revision,
            google_maps_url, path_json, path_cache_status,
            path_cache_updated_at, path_cache_expires_at, path_cache_error, active
     FROM routes WHERE id = $1`,
    [routeId],
  );
  if (!routeRow) return null;
  const stopRows = await fetchRouteStops([routeId]);
  return mapRouteDetail(routeRow, stopRows);
}

export async function fetchActiveRegistrationByUserId(userId: string) {
  return queryOne<RegistrationRow>(
    `SELECT id, user_id, route_id, route_stop_id, status
     FROM user_registrations
     WHERE user_id = $1 AND status = 'active'
     LIMIT 1`,
    [userId],
  );
}

export async function fetchRegistrationResponseByUserId(userId: string) {
  const registration = await fetchActiveRegistrationByUserId(userId);
  if (!registration) {
    return { registered: false as const, registration: null, stop_active: true };
  }

  const route = await fetchRouteWithStops(registration.route_id);
  const routeStop = route?.stops.find((stop) => stop.id === registration.route_stop_id) ?? null;
  const stopActive = await queryOne<{ active: boolean }>(
    `SELECT active FROM route_stops WHERE id = $1`,
    [registration.route_stop_id],
  );

  if (!route || !routeStop) {
    return { registered: false as const, registration: null, stop_active: true };
  }

  return {
    registered: true as const,
    registration: {
      ...registration,
      route,
      route_stop: routeStop,
    },
    stop_active: stopActive?.active ?? true,
  };
}

export async function upsertRegistrationForUser(params: {
  userId: string;
  routeCode: string;
  routeStopId: string;
}): Promise<{ registrationId: string }> {
  const route = await queryOne<{ id: string }>(
    `SELECT id FROM routes WHERE route_code = $1 AND active = true`,
    [params.routeCode],
  );
  if (!route) {
    throw Object.assign(new Error('Route not found'), { status: 404 });
  }

  const stop = await queryOne<{ id: string }>(
    `SELECT id FROM route_stops WHERE id = $1 AND route_id = $2 AND active = true`,
    [params.routeStopId, route.id],
  );
  if (!stop) {
    throw Object.assign(
      new Error('route_stop_id does not belong to route'),
      { status: 400 },
    );
  }

  return withTransaction(async (client) => {
    await client.query(
      `UPDATE user_registrations
       SET status = 'inactive', updated_at = NOW()
       WHERE user_id = $1 AND status = 'active'`,
      [params.userId],
    );

    const registrationId = randomUUID();
    const upserted = await client
      .query<{ id: string }>(
        `INSERT INTO user_registrations
           (id, user_id, route_id, route_stop_id, status)
         VALUES ($1, $2, $3, $4, 'active')
         ON CONFLICT (user_id, route_id)
         DO UPDATE SET
           route_stop_id = EXCLUDED.route_stop_id,
           status = 'active',
           updated_at = NOW()
         RETURNING id`,
        [registrationId, params.userId, route.id, params.routeStopId],
      )
      .then((result) => result.rows[0]!);

    return {
      registrationId: upserted.id,
    };
  });
}

export async function deactivateRegistrationForUser(userId: string) {
  const rows = await query<{ id: string }>(
    `UPDATE user_registrations
     SET status = 'inactive',
         updated_at = NOW()
     WHERE user_id = $1
       AND status = 'active'
     RETURNING id`,
    [userId],
  );

  return rows[0] ?? null;
}
