import { randomUUID, createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, withTransaction } from '@/server/db';
import { error, json, requireActor } from '@/server/http';
import { signSession } from '@/server/session';
import { upsertLineIdentity, verifyLineIdToken } from '@/server/line-auth';

export const dynamic = 'force-dynamic';

type CoreRole = 'rider' | 'driver' | 'admin';

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

interface RunRow {
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

interface NotificationRow {
  id: string;
  run_id: string;
  trigger_stop_id: string;
  stops_away: number;
  title_ko: string;
  body_ko: string;
  title_en: string;
  body_en: string;
  is_read: boolean;
  created_at: string;
  route_code: string | null;
  user_route_stop_id: string | null;
}

function parseSlug(params: { slug?: string[] }) {
  return params.slug ?? [];
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

async function handleAuthSession(request: NextRequest) {
  const body = (await request.json()) as {
    idToken?: string;
    profile?: { displayName?: string | null; pictureUrl?: string | null } | null;
  };

  if (!body.idToken) return error(400, 'idToken is required');

  const verified = await verifyLineIdToken(body.idToken);
  const actor = await upsertLineIdentity({
    verified,
    profile: body.profile ?? null,
  });
  const sessionToken = await signSession(actor);

  return json({
    userId: actor.userId,
    displayName: actor.displayName,
    pictureUrl: actor.pictureUrl,
    email: actor.email,
    phone: null,
    role: actor.role,
    idToken: sessionToken,
  });
}

async function handleRoutes(request: NextRequest) {
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

async function handleUserRegistrationGet(request: NextRequest) {
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

async function handleUserRegistrationPost(request: NextRequest) {
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

    let userId = existingIdentity?.user_id ?? randomUUID();

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
    await client.query(
      `INSERT INTO user_registrations
         (id, user_id, route_id, route_stop_id, status)
       VALUES ($1, $2, $3, $4, 'active')`,
      [registrationId, userId, route.id, body.route_stop_id],
    );

    return { registrationId, userId };
  });

  return json({ success: true, registration_id: result.registrationId }, { status: 201 });
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

async function buildStopStatesForRoute(runId: string, routeStopIds: string[]) {
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
      total_passengers:
        override.total_passengers_override ?? natural.total_passengers,
    };
  });
}

async function handleCheckinRun(request: NextRequest) {
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
  });
}

async function handleCheckinPost(request: NextRequest) {
  const actor = await requireActor(request);
  if (actor instanceof NextResponse) return actor;

  const body = (await request.json()) as {
    run_id?: string;
    route_stop_id?: string;
    additional_passengers?: number;
  };

  if (!body.run_id || !body.route_stop_id) {
    return error(400, 'run_id and route_stop_id are required');
  }

  if (
    body.additional_passengers !== undefined &&
    (!Number.isInteger(body.additional_passengers) ||
      body.additional_passengers < 0 ||
      body.additional_passengers > 9)
  ) {
    return error(400, 'additional_passengers must be an integer between 0 and 9');
  }

  const response = await withTransaction(async (client) => {
    const run = await client
      .query<RunRow>(
        `SELECT * FROM shuttle_runs WHERE id = $1 AND status = 'active' FOR UPDATE`,
        [body.run_id],
      )
      .then((res) => res.rows[0] ?? null);
    if (!run) {
      throw Object.assign(new Error('No active run found'), { status: 404 });
    }

    const stop = await client
      .query<{ id: string }>(
        `SELECT id FROM route_stops WHERE id = $1 AND route_id = $2`,
        [body.route_stop_id, run.route_id],
      )
      .then((res) => res.rows[0] ?? null);
    if (!stop) {
      throw Object.assign(
        new Error('route_stop_id does not belong to this run route'),
        { status: 400 },
      );
    }

    let identity = await client
      .query<{ id: string; user_id: string }>(
        `SELECT id, user_id FROM user_identities WHERE provider = 'line' AND provider_uid = $1`,
        [actor.providerUid],
      )
      .then((res) => res.rows[0] ?? null);
    if (!identity) {
      await client.query(
        `INSERT INTO users (id, display_name, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
        [actor.userId, 'Developer (admin)', actor.role],
      );
      await client.query(
        `INSERT INTO user_identities (id, user_id, provider, provider_uid)
         VALUES ($1, $2, 'line', $3)
         ON CONFLICT (provider, provider_uid) DO NOTHING`,
        [randomUUID(), actor.userId, actor.providerUid],
      );
      identity = { id: randomUUID(), user_id: actor.userId };
    }

    const idempotencyKey = `${identity.user_id}:${body.run_id}`;
    const newId = randomUUID();
    await client.query(
      `INSERT INTO scan_events
         (id, user_id, run_id, route_stop_id, result_code, additional_passengers, idempotency_key)
       VALUES ($1, $2, $3, $4, 'ok', $5, $6)
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [
        newId,
        identity.user_id,
        body.run_id,
        body.route_stop_id,
        body.additional_passengers ?? 0,
        idempotencyKey,
      ],
    );

    const row = await client
      .query<{ id: string }>(
        `SELECT id FROM scan_events WHERE idempotency_key = $1`,
        [idempotencyKey],
      )
      .then((res) => res.rows[0]!);
    const count = await client
      .query<{ total: bigint | number }>(
        `SELECT COALESCE(SUM(1 + additional_passengers), 0) AS total
         FROM scan_events WHERE run_id = $1 AND route_stop_id = $2`,
        [body.run_id, body.route_stop_id],
      )
      .then((res) => res.rows[0]);

    return {
      success: true,
      checkin_id: row.id,
      stop_state: {
        route_stop_id: body.route_stop_id,
        total_passengers: Number(count?.total ?? 0),
        status: 'arrived',
      },
    };
  }).catch((caught: unknown) => {
    const status = (caught as { status?: number }).status ?? 500;
    const message =
      caught instanceof Error ? caught.message : 'Check-in failed';
    return error(status, message);
  });

  return response instanceof NextResponse ? response : json(response);
}

async function handleCheckinMe(request: NextRequest) {
  const actor = await requireActor(request);
  if (actor instanceof NextResponse) return actor;

  const runId = request.nextUrl.searchParams.get('run_id');
  if (!runId) return error(400, 'run_id is required');

  const identity = await queryOne<{ user_id: string }>(
    `SELECT user_id FROM user_identities WHERE provider = 'line' AND provider_uid = $1`,
    [actor.providerUid],
  );
  if (!identity) {
    return new NextResponse(null, { status: 204 });
  }

  const idempotencyKey = `${identity.user_id}:${runId}`;
  const row = await queryOne<{ id: string; route_stop_id: string }>(
    `SELECT id, route_stop_id FROM scan_events WHERE idempotency_key = $1`,
    [idempotencyKey],
  );
  if (!row) {
    return new NextResponse(null, { status: 204 });
  }

  const count = await queryOne<{ total: bigint | number }>(
    `SELECT COALESCE(SUM(1 + additional_passengers), 0) AS total
     FROM scan_events WHERE run_id = $1 AND route_stop_id = $2`,
    [runId, row.route_stop_id],
  );

  return json({
    checkin_id: row.id,
    route_stop_id: row.route_stop_id,
    stop_state: {
      route_stop_id: row.route_stop_id,
      total_passengers: Number(count?.total ?? 0),
      status: 'arrived',
    },
  });
}

async function handleRunStatus(request: NextRequest) {
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

async function handleNotifications(request: NextRequest) {
  const actor = await requireActor(request);
  if (actor instanceof NextResponse) return actor;

  const rows = await query<NotificationRow>(
    `SELECT id, run_id, trigger_stop_id, stops_away,
            title_ko, body_ko, title_en, body_en,
            is_read, created_at, route_code, user_route_stop_id
     FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [actor.userId],
  );

  return json(rows);
}

async function handleNotificationReadAll(request: NextRequest) {
  const actor = await requireActor(request);
  if (actor instanceof NextResponse) return actor;

  await query(
    `UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`,
    [actor.userId],
  );

  return json({ success: true });
}

async function handleNotificationRead(request: NextRequest, notificationId: string) {
  const actor = await requireActor(request);
  if (actor instanceof NextResponse) return actor;

  const row = await queryOne<{ id: string }>(
    `UPDATE notifications SET is_read = true
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [notificationId, actor.userId],
  );
  if (!row) return error(404, 'Notification not found');
  return json({ success: true });
}

async function handleNotificationDelete(
  request: NextRequest,
  notificationId: string,
) {
  const actor = await requireActor(request);
  if (actor instanceof NextResponse) return actor;

  const row = await queryOne<{ id: string }>(
    `DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id`,
    [notificationId, actor.userId],
  );
  if (!row) return error(404, 'Notification not found');
  return json({ success: true });
}

async function handleMePreferences(request: NextRequest) {
  const actor = await requireActor(request);
  if (actor instanceof NextResponse) return actor;

  const body = (await request.json()) as {
    push_notifications_enabled?: boolean;
  };

  if (typeof body.push_notifications_enabled !== 'boolean') {
    return error(400, 'push_notifications_enabled must be a boolean');
  }

  await query(
    `UPDATE users SET push_notifications_enabled = $1 WHERE id = $2`,
    [body.push_notifications_enabled, actor.userId],
  );

  return json({
    success: true,
    push_notifications_enabled: body.push_notifications_enabled,
  });
}

async function handleAdminUsers(request: NextRequest) {
  const actor = await requireActor(request, 'admin');
  if (actor instanceof NextResponse) return actor;

  if (request.method === 'GET') {
    const rows = await query<{
      user_id: string;
      display_name: string | null;
      picture_url: string | null;
      role: CoreRole;
      provider: string;
      provider_uid: string;
    }>(
      `SELECT u.id AS user_id, u.display_name, u.picture_url, u.role,
              ui.provider, ui.provider_uid
       FROM users u
       JOIN user_identities ui ON ui.user_id = u.id
       WHERE u.role IN ('admin', 'driver')
       ORDER BY u.role, u.display_name`,
    );
    return json(rows);
  }

  if (request.method === 'POST') {
    const body = (await request.json()) as {
      provider_uid?: string;
      provider?: string;
      role?: CoreRole;
    };
    if (!body.provider_uid || !body.role) {
      return error(400, 'provider_uid and role are required');
    }
    if (!['admin', 'driver'].includes(body.role)) {
      return error(400, "role must be 'admin' or 'driver'");
    }

    const identity = await queryOne<{ user_id: string }>(
      `SELECT user_id FROM user_identities WHERE provider = $1 AND provider_uid = $2`,
      [body.provider ?? 'line', body.provider_uid],
    );
    if (!identity) {
      return error(404, 'User not found. They must log in at least once.');
    }
    await query(`UPDATE users SET role = $1 WHERE id = $2`, [
      body.role,
      identity.user_id,
    ]);
    const updated = await queryOne<{
      user_id: string;
      display_name: string | null;
      picture_url: string | null;
      role: CoreRole;
      provider: string;
      provider_uid: string;
    }>(
      `SELECT u.id AS user_id, u.display_name, u.picture_url, u.role,
              ui.provider, ui.provider_uid
       FROM users u
       JOIN user_identities ui ON ui.user_id = u.id
       WHERE u.id = $1`,
      [identity.user_id],
    );
    return json(updated);
  }

  return error(405, 'Method not allowed');
}

async function handleAdminRoutes(request: NextRequest, routeId?: string, suffix?: string[]) {
  const actor = await requireActor(request, 'admin');
  if (actor instanceof NextResponse) return actor;

  if (request.method === 'GET' && !routeId) {
    const rows = await query(
      `SELECT
         r.id, r.route_code, r.name, r.display_name, r.line, r.service, r.direction,
         r.google_maps_url, r.sync_status, r.last_synced_at, r.sync_error, r.active,
         COUNT(rs.id)::int AS stop_count,
         COUNT(rs.id) FILTER (WHERE rs.is_pickup_enabled = true AND rs.pickup_time IS NULL)::int AS incomplete_stop_count
       FROM routes r
       LEFT JOIN route_stops rs ON rs.route_id = r.id AND rs.active = true
       GROUP BY r.id
       ORDER BY r.line, r.service, r.route_code`,
    );
    return json(rows);
  }

  if (request.method === 'GET' && routeId && suffix?.[0] === 'stops') {
    const stops = await query(
      `SELECT
         rs.id AS route_stop_id,
         rs.place_id,
         rs.sequence,
         rs.pickup_time,
         rs.notes AS route_stop_notes,
         rs.is_pickup_enabled,
         p.google_place_id,
         p.name AS place_name,
         p.display_name AS place_display_name,
         p.notes AS place_notes,
         p.formatted_address,
         p.lat,
         p.lng,
         p.is_terminal,
         p.stop_id
       FROM route_stops rs
       JOIN places p ON p.id = rs.place_id
       WHERE rs.route_id = $1
       ORDER BY rs.sequence ASC`,
      [routeId],
    );
    return json(stops);
  }

  if (request.method === 'GET' && routeId) {
    const row = await queryOne(
      `SELECT
         r.id, r.route_code, r.name, r.display_name, r.line, r.service, r.direction,
         r.google_maps_url, r.sync_status, r.last_synced_at, r.sync_error, r.active,
         COUNT(rs.id)::int AS stop_count,
         COUNT(rs.id) FILTER (WHERE rs.is_pickup_enabled = true AND rs.pickup_time IS NULL)::int AS incomplete_stop_count
       FROM routes r
       LEFT JOIN route_stops rs ON rs.route_id = r.id AND rs.active = true
       WHERE r.id = $1
       GROUP BY r.id`,
      [routeId],
    );
    if (!row) return error(404, 'Route not found');
    return json(row);
  }

  return error(405, 'Method not allowed');
}

async function handleAdminSchedules(request: NextRequest, scheduleId?: string) {
  const actor = await requireActor(request, 'admin');
  if (actor instanceof NextResponse) return actor;

  if (request.method === 'GET' && !scheduleId) {
    const rows = await query(
      `SELECT
         s.id, s.name, s.status, s.created_at, s.created_by, s.published_at, s.published_by,
         EXISTS (
           SELECT 1 FROM schedule_routes sr
           WHERE sr.schedule_id = s.id
             AND EXISTS (
               SELECT 1 FROM jsonb_array_elements(sr.stops_snapshot) AS stop
               WHERE (stop->>'change_type') IN ('updated', 'added')
                 AND (stop->>'pickup_time') IS NULL
                 AND (stop->>'is_pickup_enabled')::boolean = true
             )
         ) AS has_incomplete_stops
       FROM schedules s
       ORDER BY s.created_at DESC`,
    );
    return json(rows);
  }

  if (request.method === 'GET' && scheduleId) {
    const schedule = await queryOne(
      `SELECT id, name, status, created_at, created_by, published_at, published_by
       FROM schedules WHERE id = $1`,
      [scheduleId],
    );
    if (!schedule) return error(404, 'Schedule not found');
    const routes = await query(
      `SELECT
         sr.id, sr.schedule_id, sr.route_id, sr.stops_snapshot,
         sr.sync_status, sr.synced_at, sr.sync_error,
         r.route_code, r.name AS route_name, r.display_name, r.line, r.service, r.direction,
         r.google_maps_url, r.active AS active
       FROM schedule_routes sr
       JOIN routes r ON r.id = sr.route_id
       WHERE sr.schedule_id = $1
       ORDER BY r.line, r.service, r.route_code`,
      [scheduleId],
    );
    return json({ ...schedule, routes });
  }

  return error(405, 'Method not allowed');
}

async function handleAdminRegistrations(request: NextRequest, registrationId?: string) {
  const actor = await requireActor(request, 'admin');
  if (actor instanceof NextResponse) return actor;

  if (request.method === 'GET') {
    const status = request.nextUrl.searchParams.get('status') ?? 'active';
    if (!['active', 'inactive', 'all'].includes(status)) {
      return error(400, "status must be 'active', 'inactive', or 'all'");
    }
    const whereClause = status === 'all' ? '' : `WHERE ur.status = '${status}'`;
    const rows = await query(
      `SELECT
         ur.id AS registration_id,
         u.id AS user_id,
         u.display_name,
         u.picture_url,
         r.route_code,
         r.name AS route_name,
         r.display_name AS route_display_name,
         rs.id AS route_stop_id,
         rs.sequence,
         rs.pickup_time,
         p.name AS place_name,
         p.display_name AS place_display_name,
         ur.status,
         ur.registered_at,
         ur.updated_at
       FROM user_registrations ur
       JOIN users u ON u.id = ur.user_id
       JOIN routes r ON r.id = ur.route_id
       JOIN route_stops rs ON rs.id = ur.route_stop_id
       JOIN places p ON p.id = rs.place_id
       ${whereClause}
       ORDER BY ur.registered_at DESC NULLS LAST`,
    );
    return json(rows);
  }

  if (request.method === 'DELETE' && registrationId) {
    const row = await queryOne<{ id: string }>(
      `DELETE FROM user_registrations WHERE id = $1 RETURNING id`,
      [registrationId],
    );
    if (!row) return error(404, 'Registration not found');
    return json({ success: true, id: registrationId });
  }

  return error(405, 'Method not allowed');
}

async function handleAdminRuns(request: NextRequest, runId?: string, suffix?: string[]) {
  const actor = await requireActor(request, 'driver');
  if (actor instanceof NextResponse) return actor;

  if (request.method === 'GET' && !runId) {
    const status = request.nextUrl.searchParams.get('status');
    const routeCode = request.nextUrl.searchParams.get('routeCode');
    let sql = `
      SELECT sr.*, r.route_code
      FROM shuttle_runs sr
      JOIN routes r ON r.id = sr.route_id
      WHERE 1=1`;
    const params: unknown[] = [];
    if (status) {
      params.push(status);
      sql += ` AND sr.status = $${params.length}`;
    }
    if (routeCode) {
      params.push(routeCode);
      sql += ` AND r.route_code = $${params.length}`;
    }
    sql += ' ORDER BY sr.service_date DESC, sr.started_at DESC NULLS LAST';
    const rows = await query(sql, params);
    return json(rows);
  }

  if (request.method === 'POST' && !runId) {
    const body = (await request.json()) as {
      route_code?: string;
      service_date?: string;
    };
    if (!body.route_code) return error(400, 'route_code is required');
    const route = await queryOne<{ id: string }>(
      `SELECT id FROM routes WHERE route_code = $1 AND active = true`,
      [body.route_code],
    );
    if (!route) return error(404, 'Route not found');

    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM shuttle_runs WHERE route_id = $1 AND status = 'active'`,
      [route.id],
    );
    if (existing) {
      return json(
        { error: 'An active run already exists for this route', run_id: existing.id },
        { status: 409 },
      );
    }

    const newId = randomUUID();
    await query(
      `INSERT INTO shuttle_runs
         (id, route_id, service_date, status, started_at, created_mode, created_by)
       VALUES ($1, $2, $3, 'active', NOW(), 'manual', $4)`,
      [newId, route.id, body.service_date ?? new Date().toISOString(), actor.userId],
    );
    const created = await queryOne<RunRow>(
      `SELECT * FROM shuttle_runs WHERE id = $1`,
      [newId],
    );
    return json(created, { status: 201 });
  }

  if (request.method === 'POST' && runId && suffix?.[0] === 'end') {
    const run = await queryOne<RunRow>(
      `SELECT * FROM shuttle_runs WHERE id = $1`,
      [runId],
    );
    if (!run) return error(404, 'Run not found');
    if (run.status !== 'active') return error(409, `Run is already ${run.status}`);
    await query(
      `UPDATE shuttle_runs
       SET status = 'completed', ended_at = NOW(), ended_mode = 'manual', ended_by = $1
       WHERE id = $2`,
      [actor.userId, runId],
    );
    const updated = await queryOne<RunRow>(
      `SELECT * FROM shuttle_runs WHERE id = $1`,
      [runId],
    );
    return json(updated);
  }

  if (request.method === 'GET' && runId && suffix?.[0] === 'results') {
    const run = await queryOne<RunRow>(
      `SELECT * FROM shuttle_runs WHERE id = $1`,
      [runId],
    );
    if (!run) return error(404, 'Run not found');
    const route = await queryOne<{ route_code: string; display_name: string | null }>(
      `SELECT route_code, display_name FROM routes WHERE id = $1`,
      [run.route_id],
    );
    const stopIds = await query<{ id: string }>(
      `SELECT id FROM route_stops WHERE route_id = $1 ORDER BY sequence ASC`,
      [run.route_id],
    );
    const events = await query<{
      route_stop_id: string;
      user_id: string;
      display_name: string | null;
      picture_url: string | null;
      additional_passengers: number;
      scanned_at: string;
    }>(
      `SELECT se.route_stop_id, se.user_id, u.display_name, u.picture_url,
              se.additional_passengers, se.scanned_at
       FROM scan_events se
       JOIN users u ON u.id = se.user_id
       WHERE se.run_id = $1
       ORDER BY se.scanned_at ASC`,
      [runId],
    );
    const ridersByStop = new Map<string, typeof events>();
    events.forEach((event) => {
      const list = ridersByStop.get(event.route_stop_id) ?? [];
      list.push(event);
      ridersByStop.set(event.route_stop_id, list);
    });
    const stopResults = stopIds.map(({ id }) => {
      const riders = ridersByStop.get(id) ?? [];
      return {
        route_stop_id: id,
        total_passengers: riders.reduce(
          (sum, rider) => sum + 1 + rider.additional_passengers,
          0,
        ),
        status: riders.length > 0 ? 'arrived' : 'waiting',
        riders,
      };
    });
    return json({
      run,
      route: {
        route_code: route?.route_code ?? '',
        display_name: route?.display_name ?? null,
      },
      stop_results: stopResults,
    });
  }

  return error(405, 'Method not allowed');
}

async function handleAutoRun(request: NextRequest) {
  const actor = await requireActor(request, 'admin');
  if (actor instanceof NextResponse) return actor;

  if (request.method === 'GET') {
    const row = await queryOne(
      `SELECT id, enabled, days_of_week, start_time, end_time, updated_at, updated_by
       FROM auto_run_config WHERE id = 'singleton'`,
    );
    if (!row) return error(500, 'Config row missing');
    return json(row);
  }

  if (request.method === 'PUT') {
    const body = (await request.json()) as {
      enabled?: boolean;
      days_of_week?: number[];
      start_time?: string;
      end_time?: string;
    };
    const sets: string[] = ['updated_at = NOW()', 'updated_by = $1'];
    const params: unknown[] = [actor.userId];
    let index = 2;
    if (body.enabled !== undefined) {
      sets.push(`enabled = $${index++}`);
      params.push(body.enabled);
    }
    if (body.days_of_week !== undefined) {
      sets.push(`days_of_week = $${index++}`);
      params.push(body.days_of_week);
    }
    if (body.start_time !== undefined) {
      sets.push(`start_time = $${index++}`);
      params.push(body.start_time);
    }
    if (body.end_time !== undefined) {
      sets.push(`end_time = $${index++}`);
      params.push(body.end_time);
    }
    const row = await queryOne(
      `UPDATE auto_run_config SET ${sets.join(', ')} WHERE id = 'singleton'
       RETURNING id, enabled, days_of_week, start_time, end_time, updated_at, updated_by`,
      params,
    );
    return json(row);
  }

  return error(405, 'Method not allowed');
}

async function routeRequest(request: NextRequest, params: { slug?: string[] }) {
  const slug = parseSlug(params);

  if (slug.length === 0) return error(404, 'Not found');
  if (slug[0] === 'line-auth' && slug[1] === 'session' && request.method === 'POST') {
    return handleAuthSession(request);
  }
  if (slug[0] === 'routes' && request.method === 'GET') {
    return handleRoutes(request);
  }
  if (slug[0] === 'user-registration') {
    if (request.method === 'GET') return handleUserRegistrationGet(request);
    if (request.method === 'POST') return handleUserRegistrationPost(request);
  }
  if (slug[0] === 'checkin') {
    if (slug[1] === 'run' && request.method === 'GET') return handleCheckinRun(request);
    if (slug[1] === 'me' && request.method === 'GET') return handleCheckinMe(request);
    if (slug[1] === 'run-status' && request.method === 'GET') return handleRunStatus(request);
    if (slug.length === 1 && request.method === 'POST') return handleCheckinPost(request);
  }
  if (slug[0] === 'notifications') {
    if (slug.length === 1 && request.method === 'GET') return handleNotifications(request);
    if (slug[1] === 'read-all' && request.method === 'PATCH') {
      return handleNotificationReadAll(request);
    }
    if (slug.length === 3 && slug[2] === 'read' && request.method === 'PATCH') {
      return handleNotificationRead(request, slug[1]);
    }
    if (slug.length === 2 && request.method === 'DELETE') {
      return handleNotificationDelete(request, slug[1]);
    }
  }
  if (slug[0] === 'me' && slug[1] === 'preferences' && request.method === 'PATCH') {
    return handleMePreferences(request);
  }
  if (slug[0] === 'admin') {
    if (slug[1] === 'users') {
      return handleAdminUsers(request);
    }
    if (slug[1] === 'routes') {
      return handleAdminRoutes(request, slug[2], slug.slice(3));
    }
    if (slug[1] === 'schedules') {
      return handleAdminSchedules(request, slug[2]);
    }
    if (slug[1] === 'registrations') {
      return handleAdminRegistrations(request, slug[2]);
    }
    if (slug[1] === 'runs') {
      return handleAdminRuns(request, slug[2], slug.slice(3));
    }
    if (slug[1] === 'run-schedule') {
      return handleAutoRun(request);
    }
  }

  return error(404, 'Not found');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug?: string[] }> },
) {
  return routeRequest(request, await params);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug?: string[] }> },
) {
  return routeRequest(request, await params);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug?: string[] }> },
) {
  return routeRequest(request, await params);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug?: string[] }> },
) {
  return routeRequest(request, await params);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug?: string[] }> },
) {
  return routeRequest(request, await params);
}
