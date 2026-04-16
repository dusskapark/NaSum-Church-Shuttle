import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { query, queryOne, withTransaction } from '@/server/db';
import { json, error } from '@/server/http';

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

async function fetchRouteWithStops(routeId: string) {
  const routeRow = await queryOne<RouteRow>(
    `SELECT id, route_code, name, display_name, line, service, revision,
            google_maps_url, path_json, path_cache_status,
            path_cache_updated_at, path_cache_expires_at, path_cache_error, active
     FROM routes WHERE id = $1`,
    [routeId],
  );
  if (!routeRow) return null;
  const stopRows = await fetchRouteStops([routeId]);
  return {
    ...routeRow,
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
        lat: Number(stop.lat),
        lng: Number(stop.lng),
        place_types: stop.place_types ?? [],
        notes: stop.place_notes,
        is_terminal: stop.is_terminal,
        stop_id: stop.stop_id,
      },
    })),
  };
}

export async function GET(request: NextRequest) {
  const providerUid = request.nextUrl.searchParams.get('provider_uid');
  const provider = request.nextUrl.searchParams.get('provider') ?? 'line';

  if (!providerUid) return error(400, 'provider_uid required');

  const identity = await queryOne<{
    id: string;
    user_id: string;
    user_display_name: string | null;
  }>(
    `SELECT ui.id, ui.user_id, u.display_name AS user_display_name
     FROM user_identities ui
     JOIN users u ON u.id = ui.user_id
     WHERE ui.provider = $1 AND ui.provider_uid = $2`,
    [provider, providerUid],
  );

  if (!identity) return json({ registered: false });

  const registration = await queryOne<{
    id: string;
    user_id: string;
    route_id: string;
    route_stop_id: string;
    status: string;
  }>(
    `SELECT id, user_id, route_id, route_stop_id, status
     FROM user_registrations
     WHERE user_id = $1 AND status = 'active'
     LIMIT 1`,
    [identity.user_id],
  );

  if (!registration) {
    return json({
      registered: false,
      user: { id: identity.user_id, display_name: identity.user_display_name },
    });
  }

  const route = await fetchRouteWithStops(registration.route_id);
  const routeStop = route?.stops.find((stop) => stop.id === registration.route_stop_id) ?? null;
  const stopActive = await queryOne<{ active: boolean }>(
    `SELECT active FROM route_stops WHERE id = $1`,
    [registration.route_stop_id],
  );

  if (!route || !routeStop) {
    return json({
      registered: false,
      user: { id: identity.user_id, display_name: identity.user_display_name },
    });
  }

  return json({
    registered: true,
    user: { id: identity.user_id, display_name: identity.user_display_name },
    registration: {
      ...registration,
      route,
      route_stop: routeStop,
    },
    stop_active: stopActive?.active ?? true,
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    provider?: string;
    provider_uid?: string;
    display_name?: string | null;
    picture_url?: string | null;
    route_code?: string;
    route_stop_id?: string;
  };

  const provider = body.provider ?? 'line';
  if (!body.provider_uid || !body.route_code || !body.route_stop_id) {
    return error(400, 'provider_uid, route_code, route_stop_id required');
  }

  const route = await queryOne<{ id: string }>(
    `SELECT id FROM routes WHERE route_code = $1 AND active = true`,
    [body.route_code],
  );
  if (!route) return error(404, 'Route not found');

  const stop = await queryOne<{ id: string }>(
    `SELECT id FROM route_stops WHERE id = $1 AND route_id = $2 AND active = true`,
    [body.route_stop_id, route.id],
  );
  if (!stop) return error(400, 'route_stop_id does not belong to route');

  const result = await withTransaction(async (client) => {
    const existingIdentity = await client
      .query<{ id: string; user_id: string }>(
        `SELECT id, user_id FROM user_identities WHERE provider = $1 AND provider_uid = $2`,
        [provider, body.provider_uid],
      )
      .then((res) => res.rows[0] ?? null);

    const userId = existingIdentity?.user_id ?? randomUUID();

    if (!existingIdentity) {
      await client.query(
        `INSERT INTO users (id, display_name, picture_url) VALUES ($1, $2, $3)`,
        [userId, body.display_name ?? null, body.picture_url ?? null],
      );
      await client.query(
        `INSERT INTO user_identities (id, user_id, provider, provider_uid)
         VALUES ($1, $2, $3, $4)`,
        [randomUUID(), userId, provider, body.provider_uid],
      );
    }

    await client.query(
      `UPDATE user_registrations SET status = 'inactive', updated_at = NOW()
       WHERE user_id = $1 AND status = 'active'`,
      [userId],
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
        [registrationId, userId, route.id, body.route_stop_id],
      )
      .then((res) => res.rows[0]!);

    return { registrationId: upserted.id };
  });

  return json({ success: true, registration_id: result.registrationId }, { status: 201 });
}
