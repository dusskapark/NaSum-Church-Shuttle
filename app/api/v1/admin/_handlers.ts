import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, withTransaction } from '@/server/db';
import { error, json, requireActor } from '@/server/http';
import { env } from '@/server/env';
import {
  parseGoogleMapsUrl,
  resolveWaypoint,
  type PlaceResult,
} from '@/server/google-places';
import { notifyApproachingUsers } from '@/server/notifications';

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

interface ScheduleStopSnapshotItem {
  route_stop_id: string | null;
  sequence: number;
  pickup_time: string | null;
  is_pickup_enabled: boolean;
  notes: string | null;
  place_id: string | null;
  google_place_id: string;
  place_name: string;
  place_display_name: string | null;
  formatted_address: string | null;
  lat: number;
  lng: number;
  place_types: string[];
  place_notes: string | null;
  is_terminal: boolean;
  stop_id: string | null;
  change_type: 'unchanged' | 'added' | 'updated' | 'removed';
}
function generateScheduleName(existingNames: string[]): string {
  const base = new Date().toISOString().slice(0, 10);
  if (!existingNames.includes(base)) return base;

  let suffix = 2;
  while (existingNames.includes(`${base} (${suffix})`)) {
    suffix += 1;
  }
  return `${base} (${suffix})`;
}

interface RouteStopSnapshotRow {
  route_stop_id: string;
  place_id: string;
  google_place_id: string;
  sequence: number;
  pickup_time: string | null;
  route_stop_notes: string | null;
  is_pickup_enabled: boolean;
  place_display_name: string | null;
  formatted_address: string | null;
  lat: number;
  lng: number;
  place_types: string[];
  place_notes: string | null;
  is_terminal: boolean;
  stop_id: string | null;
  place_name: string;
  active: boolean;
}

async function fetchRouteStopSnapshotRows(
  routeId: string,
): Promise<RouteStopSnapshotRow[]> {
  return query<RouteStopSnapshotRow>(
    `SELECT
       rs.id AS route_stop_id,
       rs.place_id,
       p.google_place_id,
       rs.sequence,
       rs.pickup_time,
       rs.notes AS route_stop_notes,
       rs.is_pickup_enabled,
       p.display_name AS place_display_name,
       p.formatted_address,
       p.lat,
       p.lng,
       p.place_types,
       p.notes AS place_notes,
       p.is_terminal,
       p.stop_id,
       p.name AS place_name,
       rs.active
     FROM route_stops rs
     JOIN places p ON p.id = rs.place_id
     WHERE rs.route_id = $1
     ORDER BY rs.sequence ASC`,
    [routeId],
  );
}

function toScheduleSnapshot(stop: RouteStopSnapshotRow): ScheduleStopSnapshotItem {
  return {
    route_stop_id: stop.route_stop_id,
    sequence: stop.sequence,
    pickup_time: stop.pickup_time,
    is_pickup_enabled: stop.is_pickup_enabled,
    notes: stop.route_stop_notes,
    place_id: stop.place_id,
    google_place_id: stop.google_place_id,
    place_name: stop.place_name,
    place_display_name: stop.place_display_name,
    formatted_address: stop.formatted_address,
    lat: Number(stop.lat),
    lng: Number(stop.lng),
    place_types: stop.place_types ?? [],
    place_notes: stop.place_notes,
    is_terminal: stop.is_terminal,
    stop_id: stop.stop_id,
    change_type: 'unchanged',
  };
}

async function buildLiveRouteSnapshot(
  routeId: string,
): Promise<ScheduleStopSnapshotItem[]> {
  const stopRows = await fetchRouteStopSnapshotRows(routeId);
  return stopRows.filter((row) => row.active).map(toScheduleSnapshot);
}

async function syncRouteSnapshot(
  routeId: string,
  googleMapsUrl: string,
  apiKey: string,
  previousSnapshot?: ScheduleStopSnapshotItem[],
): Promise<{ snapshot: ScheduleStopSnapshotItem[]; unresolved: number }> {
  const waypoints = await parseGoogleMapsUrl(googleMapsUrl);
  if (waypoints.length === 0) throw new Error('No waypoints found in URL');

  const resolvedRaw = await Promise.all(
    waypoints.map((waypoint) => resolveWaypoint(waypoint, apiKey)),
  );

  const resolved: Array<PlaceResult & { sequence: number }> = [];
  const seenPlaceIds = new Set<string>();
  let unresolved = 0;

  for (const result of resolvedRaw) {
    if (!result) {
      unresolved += 1;
      continue;
    }
    if (seenPlaceIds.has(result.googlePlaceId)) continue;
    seenPlaceIds.add(result.googlePlaceId);
    resolved.push({
      ...result,
      sequence: resolved.length + 1,
    });
  }

  console.log(
    `[route-sync] route=${routeId}, waypoint_count=${waypoints.length}, resolved_unique=${resolved.length}, unresolved=${unresolved}`,
  );

  if (resolved.length === 0) {
    throw new Error('All waypoints failed to resolve from Google Places API');
  }

  const globalPlaces = await query<{
    id: string;
    google_place_id: string;
    display_name: string | null;
    notes: string | null;
    is_terminal: boolean;
    stop_id: string | null;
  }>(
    `SELECT id, google_place_id, display_name, notes, is_terminal, stop_id
     FROM places
     WHERE google_place_id = ANY($1::text[])`,
    [resolved.map((place) => place.googlePlaceId)],
  );
  const globalByPlaceId = new Map(
    globalPlaces.map((place) => [place.google_place_id, place]),
  );

  const allStops = await fetchRouteStopSnapshotRows(routeId);
  const currentActive = allStops.filter((stop) => stop.active).map(toScheduleSnapshot);
  const baseline = previousSnapshot ?? currentActive;
  const baselineByPlaceId = new Map(
    baseline.map((stop) => [stop.google_place_id, stop]),
  );
  const currentByPlaceId = new Map(
    currentActive.map((stop) => [stop.google_place_id, stop]),
  );

  const snapshot: ScheduleStopSnapshotItem[] = resolved.map((place) => {
    const current = currentByPlaceId.get(place.googlePlaceId);
    const base = baselineByPlaceId.get(place.googlePlaceId);
    const shared = globalByPlaceId.get(place.googlePlaceId);

    let changeType: ScheduleStopSnapshotItem['change_type'] = 'unchanged';
    if (!base) {
      changeType = 'added';
    } else if (base.sequence !== place.sequence) {
      changeType = 'updated';
    }

    return {
      route_stop_id: current?.route_stop_id ?? base?.route_stop_id ?? null,
      sequence: place.sequence,
      pickup_time: current?.pickup_time ?? base?.pickup_time ?? null,
      is_pickup_enabled:
        current?.is_pickup_enabled ??
        base?.is_pickup_enabled ??
        place.sequence < resolved.length,
      notes: current?.notes ?? base?.notes ?? null,
      place_id: current?.place_id ?? base?.place_id ?? shared?.id ?? null,
      google_place_id: place.googlePlaceId,
      place_name: place.name,
      // Always normalize display_name from the latest Google Place payload.
      place_display_name: place.name || (shared?.display_name ?? null),
      formatted_address: place.formattedAddress,
      lat: place.lat,
      lng: place.lng,
      place_types: place.types ?? [],
      place_notes: current?.place_notes ?? base?.place_notes ?? shared?.notes ?? null,
      is_terminal:
        current?.is_terminal ??
        base?.is_terminal ??
        shared?.is_terminal ??
        place.sequence === resolved.length,
      stop_id: current?.stop_id ?? base?.stop_id ?? shared?.stop_id ?? null,
      change_type: changeType,
    };
  });

  const newPlaceIds = new Set(snapshot.map((stop) => stop.google_place_id));
  for (const base of baseline) {
    if (!newPlaceIds.has(base.google_place_id)) {
      const current = currentByPlaceId.get(base.google_place_id);
      snapshot.push({
        ...base,
        route_stop_id: current?.route_stop_id ?? base.route_stop_id,
        change_type: 'removed',
      });
    }
  }

  return { snapshot, unresolved };
}

async function applySyncedSnapshotToRoute(
  routeId: string,
  snapshot: ScheduleStopSnapshotItem[],
) {
  await withTransaction(async (client) => {
    await client.query('SET CONSTRAINTS ALL DEFERRED');

    // Avoid transient unique(route_id, sequence) collisions while remapping stops.
    await client.query(
      `UPDATE route_stops
       SET sequence = -(ABS(sequence) + 100000)
       WHERE route_id = $1`,
      [routeId],
    );

    const existingRows = await client
      .query<{
        route_stop_id: string;
        place_id: string;
        google_place_id: string;
      }>(
        `SELECT
           rs.id AS route_stop_id,
           rs.place_id,
           p.google_place_id
         FROM route_stops rs
         JOIN places p ON p.id = rs.place_id
         WHERE rs.route_id = $1`,
        [routeId],
      )
      .then((result) => result.rows);

    const existingByPlaceId = new Map(
      existingRows.map((row) => [row.google_place_id, row]),
    );

    const activeIds = new Set<string>();

    for (const stop of snapshot) {
      if (stop.change_type === 'removed') continue;

      const place = await client
        .query<{
          id: string;
          display_name: string | null;
          notes: string | null;
          is_terminal: boolean;
          stop_id: string | null;
        }>(
          `INSERT INTO places
             (id, google_place_id, name, display_name, formatted_address, primary_type, primary_type_display_name, lat, lng, place_types, notes, is_terminal, stop_id)
           VALUES
             ($1, $2, $3, $4, $5, NULL, NULL, $6, $7, $8, NULL, $9, $10)
           ON CONFLICT (google_place_id)
           DO UPDATE SET
             name = EXCLUDED.name,
             display_name = EXCLUDED.display_name,
             formatted_address = EXCLUDED.formatted_address,
             lat = EXCLUDED.lat,
             lng = EXCLUDED.lng,
             place_types = EXCLUDED.place_types
           RETURNING id, display_name, notes, is_terminal, stop_id`,
          [
            randomUUID(),
            stop.google_place_id,
            stop.place_name,
            stop.place_display_name ?? stop.place_name,
            stop.formatted_address,
            stop.lat,
            stop.lng,
            stop.place_types ?? [],
            stop.is_terminal,
            stop.stop_id,
          ],
        )
        .then((result) => result.rows[0]!);

      const existing = existingByPlaceId.get(stop.google_place_id);
      const routeStopId = stop.route_stop_id ?? existing?.route_stop_id ?? randomUUID();

      await client.query(
        `INSERT INTO route_stops
           (id, route_id, place_id, sequence, pickup_time, notes, is_pickup_enabled, active)
         VALUES
           ($1, $2, $3, $4, $5, $6, $7, true)
         ON CONFLICT (id)
         DO UPDATE SET
           place_id = EXCLUDED.place_id,
           sequence = EXCLUDED.sequence,
           pickup_time = EXCLUDED.pickup_time,
           notes = EXCLUDED.notes,
           is_pickup_enabled = EXCLUDED.is_pickup_enabled,
           active = true`,
        [
          routeStopId,
          routeId,
          place.id,
          stop.sequence,
          stop.pickup_time,
          stop.notes,
          stop.is_pickup_enabled,
        ],
      );

      activeIds.add(routeStopId);
    }

    if (activeIds.size > 0) {
      await client.query(
        `UPDATE route_stops
         SET active = false
         WHERE route_id = $1 AND id <> ALL($2::text[])`,
        [routeId, Array.from(activeIds)],
      );
    } else {
      await client.query(
        `UPDATE route_stops
         SET active = false
         WHERE route_id = $1`,
        [routeId],
      );
    }
  });
}
export async function handleAdminRoutes(request: NextRequest, routeId?: string, suffix?: string[]) {
  const actor = await requireActor(request, 'admin');
  if (actor instanceof NextResponse) return actor;

  if (request.method === 'PATCH' && routeId && (!suffix || suffix.length === 0)) {
    const body = (await request.json()) as {
      display_name?: string | null;
      google_maps_url?: string | null;
      active?: boolean;
    };

    const updates: string[] = [];
    const params: unknown[] = [];
    let index = 1;

    if (body.display_name !== undefined) {
      updates.push(`display_name = $${index++}`);
      params.push(body.display_name);
    }
    if (body.google_maps_url !== undefined) {
      updates.push(`google_maps_url = $${index++}`);
      params.push(body.google_maps_url);
      updates.push(`sync_status = 'pending'`);
      updates.push(`sync_error = NULL`);
    }
    if (body.active !== undefined) {
      updates.push(`active = $${index++}`);
      params.push(body.active);
    }

    if (updates.length === 0) {
      return error(400, 'No fields to update');
    }

    params.push(routeId);

    const updated = await queryOne(
      `UPDATE routes
       SET ${updates.join(', ')}
       WHERE id = $${index}
       RETURNING
         id, route_code, name, display_name, line, service, direction,
         google_maps_url, sync_status, last_synced_at, sync_error, active`,
      params,
    );

    if (!updated) return error(404, 'Route not found');

    const counts = await queryOne<{ stop_count: number; incomplete_stop_count: number }>(
      `SELECT
         COUNT(id)::int AS stop_count,
         COUNT(id) FILTER (WHERE is_pickup_enabled = true AND pickup_time IS NULL)::int AS incomplete_stop_count
       FROM route_stops
       WHERE route_id = $1`,
      [routeId],
    );

    return json({
      ...updated,
      stop_count: counts?.stop_count ?? 0,
      incomplete_stop_count: counts?.incomplete_stop_count ?? 0,
    });
  }

  if (request.method === 'POST' && routeId && suffix?.[0] === 'sync') {
    const route = await queryOne<{ id: string; google_maps_url: string | null }>(
      `SELECT id, google_maps_url FROM routes WHERE id = $1`,
      [routeId],
    );
    if (!route) return error(404, 'Route not found');
    if (!route.google_maps_url) return error(400, 'Route has no Google Maps URL set');

    const apiKey = env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) return error(500, 'GOOGLE_MAPS_API_KEY not configured');

    try {
      await query(
        `UPDATE routes
         SET sync_status = 'syncing', sync_error = NULL
         WHERE id = $1`,
        [routeId],
      );

      const { snapshot, unresolved } = await syncRouteSnapshot(
        routeId,
        route.google_maps_url,
        apiKey,
      );

      await applySyncedSnapshotToRoute(routeId, snapshot);

      const diff = {
        added: snapshot.filter((stop) => stop.change_type === 'added').length,
        updated: snapshot.filter((stop) => stop.change_type === 'updated').length,
        removed: snapshot.filter((stop) => stop.change_type === 'removed').length,
      };

      await query(
        `UPDATE routes
         SET sync_status = 'synced', last_synced_at = NOW(), sync_error = NULL
         WHERE id = $1`,
        [routeId],
      );

      return json({ diff, unresolved });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Sync failed';
      await query(
        `UPDATE routes
         SET sync_status = 'error', sync_error = $1
         WHERE id = $2`,
        [message, routeId],
      );
      return error(500, message);
    }
  }

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

export async function handleAdminSchedules(
  request: NextRequest,
  scheduleId?: string,
  suffix?: string[],
) {
  const actor = await requireActor(request, 'admin');
  if (actor instanceof NextResponse) return actor;

  if (request.method === 'POST' && !scheduleId) {
    const existingDraft = await queryOne<{ id: string; name: string }>(
      `SELECT id, name FROM schedules WHERE status = 'draft' LIMIT 1`,
    );
    if (existingDraft) {
      return json(
        {
          error: 'A draft schedule already exists',
          draft: existingDraft,
        },
        { status: 409 },
      );
    }

    const allNames = (await query<{ name: string }>(`SELECT name FROM schedules`)).map(
      (row) => row.name,
    );
    const name = generateScheduleName(allNames);
    const scheduleIdToCreate = randomUUID();

    const routes = await query<{
      id: string;
      route_code: string;
      name: string | null;
      display_name: string | null;
      line: string;
      service: string;
    }>(
      `SELECT id, route_code, name, display_name, line, service
       FROM routes
       WHERE active = true
       ORDER BY line, service, route_code`,
    );

    try {
      await withTransaction(async (client) => {
        await client.query(
          `INSERT INTO schedules (id, name, status, created_by)
           VALUES ($1, $2, 'draft', $3)`,
          [scheduleIdToCreate, name, actor.userId],
        );

        for (const route of routes) {
          const stopRows = await client.query<{
            route_stop_id: string;
            place_id: string;
            google_place_id: string;
            sequence: number;
            pickup_time: string | null;
            route_stop_notes: string | null;
            is_pickup_enabled: boolean;
            place_display_name: string | null;
            formatted_address: string | null;
            lat: number;
            lng: number;
            place_types: string[];
            place_notes: string | null;
            is_terminal: boolean;
            stop_id: string | null;
            place_name: string;
          }>(
            `SELECT
               rs.id AS route_stop_id,
               rs.place_id,
               p.google_place_id,
               rs.sequence,
               rs.pickup_time,
               rs.notes AS route_stop_notes,
               rs.is_pickup_enabled,
               p.display_name AS place_display_name,
               p.formatted_address,
               p.lat,
               p.lng,
               p.place_types,
               p.notes AS place_notes,
               p.is_terminal,
               p.stop_id,
               p.name AS place_name
             FROM route_stops rs
             JOIN places p ON p.id = rs.place_id
             WHERE rs.route_id = $1 AND rs.active = true
             ORDER BY rs.sequence ASC`,
            [route.id],
          );

          const snapshot = stopRows.rows.map((stop) => ({
            route_stop_id: stop.route_stop_id,
            sequence: stop.sequence,
            pickup_time: stop.pickup_time,
            is_pickup_enabled: stop.is_pickup_enabled,
            notes: stop.route_stop_notes,
            place_id: stop.place_id,
            google_place_id: stop.google_place_id,
            place_name: stop.place_name,
            place_display_name: stop.place_display_name,
            formatted_address: stop.formatted_address,
            lat: Number(stop.lat),
            lng: Number(stop.lng),
            place_types: stop.place_types ?? [],
            place_notes: stop.place_notes,
            is_terminal: stop.is_terminal,
            stop_id: stop.stop_id,
            change_type: 'unchanged',
          }));

          await client.query(
            `INSERT INTO schedule_routes (id, schedule_id, route_id, stops_snapshot, sync_status)
             VALUES ($1, $2, $3, $4, 'pending')`,
            [randomUUID(), scheduleIdToCreate, route.id, JSON.stringify(snapshot)],
          );
        }
      });
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : 'Failed to create schedule';
      if (
        message.includes('idx_schedules_single_draft') ||
        message.toLowerCase().includes('unique')
      ) {
        return json({ error: 'A draft schedule already exists' }, { status: 409 });
      }
      return error(500, message);
    }

    return json(
      {
        id: scheduleIdToCreate,
        name,
        status: 'draft',
        routes: routes.map((route) => ({
          route_id: route.id,
          route_code: route.route_code,
        })),
      },
      { status: 201 },
    );
  }

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

  if (request.method === 'POST' && scheduleId && suffix?.[0] === 'sync') {
    const apiKey = env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) return error(500, 'GOOGLE_MAPS_API_KEY not configured');

    const schedule = await queryOne<{ id: string; status: string }>(
      `SELECT id, status FROM schedules WHERE id = $1`,
      [scheduleId],
    );
    if (!schedule) return error(404, 'Schedule not found');
    if (schedule.status !== 'draft') {
      return error(403, 'Only draft schedules can be synced');
    }

    const scheduleRoutes = await query<{
      id: string;
      route_id: string;
      google_maps_url: string | null;
      stops_snapshot: ScheduleStopSnapshotItem[] | null;
    }>(
      `SELECT sr.id, sr.route_id, sr.stops_snapshot, r.google_maps_url
       FROM schedule_routes sr
       JOIN routes r ON r.id = sr.route_id
       WHERE sr.schedule_id = $1`,
      [scheduleId],
    );

    let synced = 0;
    let totalChanges = 0;
    const errors: Array<{ route_id: string; error: string }> = [];

    for (const sr of scheduleRoutes) {
      if (!sr.google_maps_url) {
        errors.push({ route_id: sr.route_id, error: 'Route has no Google Maps URL set' });
        await query(
          `UPDATE schedule_routes
           SET sync_status = 'error', sync_error = $1
           WHERE id = $2`,
          ['Route has no Google Maps URL set', sr.id],
        );
        continue;
      }

      await query(
        `UPDATE schedule_routes
         SET sync_status = 'syncing', sync_error = NULL
         WHERE id = $1`,
        [sr.id],
      );

      try {
        const { snapshot, unresolved } = await syncRouteSnapshot(
          sr.route_id,
          sr.google_maps_url,
          apiKey,
          sr.stops_snapshot ?? [],
        );
        const changes = snapshot.filter((stop) => stop.change_type !== 'unchanged').length;

        await query(
          `UPDATE schedule_routes
           SET stops_snapshot = $1, sync_status = 'synced', synced_at = NOW(), sync_error = NULL
           WHERE id = $2`,
          [JSON.stringify(snapshot), sr.id],
        );

        synced += 1;
        totalChanges += changes;
        if (unresolved > 0) {
          errors.push({
            route_id: sr.route_id,
            error: `${unresolved} waypoint(s) could not be resolved`,
          });
        }
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : 'Sync failed';
        errors.push({ route_id: sr.route_id, error: message });
        await query(
          `UPDATE schedule_routes
           SET sync_status = 'error', sync_error = $1
           WHERE id = $2`,
          [message, sr.id],
        );
      }
    }

    return json({ synced, errors, total_changes: totalChanges });
  }

  if (
    request.method === 'POST' &&
    scheduleId &&
    suffix?.[0] === 'routes' &&
    suffix?.[1] &&
    suffix?.[2] === 'sync'
  ) {
    const routeId = suffix[1];
    const scheduleRoute = await queryOne<{
      id: string;
      route_id: string;
      schedule_status: string;
      stops_snapshot: ScheduleStopSnapshotItem[] | null;
      google_maps_url: string | null;
    }>(
      `SELECT sr.id, sr.route_id, sr.stops_snapshot, r.google_maps_url, s.status AS schedule_status
       FROM schedule_routes sr
       JOIN routes r ON r.id = sr.route_id
       JOIN schedules s ON s.id = sr.schedule_id
       WHERE sr.schedule_id = $1 AND sr.route_id = $2`,
      [scheduleId, routeId],
    );
    if (!scheduleRoute) return error(404, 'Route not found in schedule');
    if (scheduleRoute.schedule_status !== 'draft') {
      return error(403, 'Only draft schedules can be synced');
    }
    if (!scheduleRoute.google_maps_url) {
      return error(400, 'Route has no Google Maps URL set');
    }

    const apiKey = env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) return error(500, 'GOOGLE_MAPS_API_KEY not configured');

    await query(
      `UPDATE schedule_routes
       SET sync_status = 'syncing', sync_error = NULL
       WHERE id = $1`,
      [scheduleRoute.id],
    );

    try {
      const { snapshot, unresolved } = await syncRouteSnapshot(
        routeId,
        scheduleRoute.google_maps_url,
        apiKey,
        scheduleRoute.stops_snapshot ?? [],
      );
      const changes = snapshot.filter((stop) => stop.change_type !== 'unchanged').length;

      await query(
        `UPDATE schedule_routes
         SET stops_snapshot = $1, sync_status = 'synced', synced_at = NOW(), sync_error = NULL
         WHERE id = $2`,
        [JSON.stringify(snapshot), scheduleRoute.id],
      );

      return json({ success: true, changes, unresolved });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Sync failed';
      await query(
        `UPDATE schedule_routes
         SET sync_status = 'error', sync_error = $1
         WHERE id = $2`,
        [message, scheduleRoute.id],
      );
      return error(500, message);
    }
  }

  if (
    request.method === 'PATCH' &&
    scheduleId &&
    suffix?.[0] === 'routes' &&
    suffix?.[1] &&
    suffix?.[2] === 'stops' &&
    suffix?.[3]
  ) {
    const routeId = suffix[1];
    const sequence = Number.parseInt(suffix[3], 10);
    if (!Number.isInteger(sequence) || sequence <= 0) {
      return error(400, 'sequence must be a positive integer');
    }

    const body = (await request.json()) as {
      pickup_time?: string | null;
      notes?: string | null;
      is_pickup_enabled?: boolean;
      display_name?: string | null;
      place_notes?: string | null;
      is_terminal?: boolean;
      google_place_id?: string | null;
      stop_id?: string | null;
    };

    if (body.pickup_time !== undefined && body.pickup_time !== null) {
      if (!/^\d{1,2}:\d{2}\s?(AM|PM)$/i.test(body.pickup_time.trim())) {
        return error(400, 'pickup_time must be in H:MM AM/PM format (e.g. 8:48 AM)');
      }
    }

    const scheduleRoute = await queryOne<{
      id: string;
      schedule_status: string;
      stops_snapshot: ScheduleStopSnapshotItem[] | null;
    }>(
      `SELECT sr.id, sr.stops_snapshot, s.status AS schedule_status
       FROM schedule_routes sr
       JOIN schedules s ON s.id = sr.schedule_id
       WHERE sr.schedule_id = $1 AND sr.route_id = $2`,
      [scheduleId, routeId],
    );

    if (!scheduleRoute) return error(404, 'Route not found in schedule');
    if (scheduleRoute.schedule_status !== 'draft') {
      return error(403, 'Only draft schedules can be edited');
    }

    const snapshot = [...(scheduleRoute.stops_snapshot ?? [])];
    const stopIndex = snapshot.findIndex((stop) => stop.sequence === sequence);
    if (stopIndex === -1) return error(404, 'Stop not found in snapshot');

    const stop = { ...snapshot[stopIndex] };
    if (body.pickup_time !== undefined) stop.pickup_time = body.pickup_time;
    if (body.notes !== undefined) stop.notes = body.notes;
    if (body.is_pickup_enabled !== undefined) {
      stop.is_pickup_enabled = body.is_pickup_enabled;
    }
    if (body.google_place_id !== undefined && body.google_place_id !== null) {
      stop.google_place_id = body.google_place_id;
    }
    if (body.display_name !== undefined) stop.place_display_name = body.display_name;
    if (body.place_notes !== undefined) stop.place_notes = body.place_notes;
    if (body.is_terminal !== undefined) stop.is_terminal = body.is_terminal;
    if (body.stop_id !== undefined) stop.stop_id = body.stop_id;

    const targetGooglePlaceId = stop.google_place_id;
    const sharedFieldTouched =
      body.google_place_id !== undefined ||
      body.display_name !== undefined ||
      body.place_notes !== undefined ||
      body.is_terminal !== undefined ||
      body.stop_id !== undefined;

    // Persist route-scoped edits (pickup_time/notes/is_pickup_enabled) before
    // shared metadata propagation so they are not lost.
    snapshot[stopIndex] = stop;

    if (sharedFieldTouched && targetGooglePlaceId) {
      const existingPlace = await queryOne<{
        id: string;
        name: string;
        display_name: string | null;
        formatted_address: string | null;
        lat: number;
        lng: number;
        place_types: string[];
        notes: string | null;
        is_terminal: boolean;
        stop_id: string | null;
      }>(
        `SELECT
           id, name, display_name, formatted_address, lat, lng,
           place_types, notes, is_terminal, stop_id
         FROM places
         WHERE google_place_id = $1`,
        [targetGooglePlaceId],
      );

      const resolvedDisplayName =
        body.display_name !== undefined
          ? body.display_name
          : (existingPlace?.display_name ?? stop.place_display_name ?? null);
      const resolvedNotes =
        body.place_notes !== undefined
          ? body.place_notes
          : (existingPlace?.notes ?? stop.place_notes ?? null);
      const resolvedIsTerminal =
        body.is_terminal !== undefined
          ? body.is_terminal
          : (existingPlace?.is_terminal ?? stop.is_terminal);
      const resolvedStopId =
        body.stop_id !== undefined
          ? body.stop_id
          : (existingPlace?.stop_id ?? stop.stop_id ?? null);

      const upsertedPlace = await queryOne<{
        id: string;
        display_name: string | null;
        notes: string | null;
        is_terminal: boolean;
        stop_id: string | null;
      }>(
        `INSERT INTO places
           (id, google_place_id, name, display_name, formatted_address, primary_type, primary_type_display_name, lat, lng, place_types, notes, is_terminal, stop_id)
         VALUES
           ($1, $2, $3, $4, $5, NULL, NULL, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (google_place_id)
         DO UPDATE SET
           name = EXCLUDED.name,
           display_name = EXCLUDED.display_name,
           formatted_address = EXCLUDED.formatted_address,
           lat = EXCLUDED.lat,
           lng = EXCLUDED.lng,
           place_types = EXCLUDED.place_types,
           notes = EXCLUDED.notes,
           is_terminal = EXCLUDED.is_terminal,
           stop_id = EXCLUDED.stop_id
         RETURNING id, display_name, notes, is_terminal, stop_id`,
        [
          randomUUID(),
          targetGooglePlaceId,
          stop.place_name || existingPlace?.name || targetGooglePlaceId,
          resolvedDisplayName,
          stop.formatted_address ?? existingPlace?.formatted_address ?? null,
          Number.isFinite(stop.lat) ? stop.lat : (existingPlace?.lat ?? 0),
          Number.isFinite(stop.lng) ? stop.lng : (existingPlace?.lng ?? 0),
          stop.place_types ?? existingPlace?.place_types ?? [],
          resolvedNotes,
          resolvedIsTerminal,
          resolvedStopId,
        ],
      );

      if (upsertedPlace) {
        for (let i = 0; i < snapshot.length; i += 1) {
          if (snapshot[i].google_place_id === targetGooglePlaceId) {
            snapshot[i] = {
              ...snapshot[i],
              place_id: upsertedPlace.id,
              place_display_name: upsertedPlace.display_name,
              place_notes: upsertedPlace.notes,
              is_terminal: upsertedPlace.is_terminal,
              stop_id: upsertedPlace.stop_id,
            };
          }
        }
      }
    }

    await query(
      `UPDATE schedule_routes
       SET stops_snapshot = $1
       WHERE id = $2`,
      [JSON.stringify(snapshot), scheduleRoute.id],
    );

    return json({ success: true });
  }

  if (
    request.method === 'DELETE' &&
    scheduleId &&
    suffix?.[0] === 'routes' &&
    suffix?.[1] &&
    suffix?.[2] === 'stops' &&
    suffix?.[3]
  ) {
    const routeId = suffix[1];
    const sequence = Number.parseInt(suffix[3], 10);
    if (!Number.isInteger(sequence) || sequence <= 0) {
      return error(400, 'sequence must be a positive integer');
    }

    const scheduleRoute = await queryOne<{
      id: string;
      schedule_status: string;
      stops_snapshot: ScheduleStopSnapshotItem[] | null;
    }>(
      `SELECT sr.id, sr.stops_snapshot, s.status AS schedule_status
       FROM schedule_routes sr
       JOIN schedules s ON s.id = sr.schedule_id
       WHERE sr.schedule_id = $1 AND sr.route_id = $2`,
      [scheduleId, routeId],
    );
    if (!scheduleRoute) return error(404, 'Route not found in schedule');
    if (scheduleRoute.schedule_status !== 'draft') {
      return error(403, 'Only draft schedules can be edited');
    }

    const snapshot = [...(scheduleRoute.stops_snapshot ?? [])];
    const stopIndex = snapshot.findIndex((stop) => stop.sequence === sequence);
    if (stopIndex === -1) return error(404, 'Stop not found in snapshot');

    if (snapshot[stopIndex].change_type === 'added') {
      snapshot.splice(stopIndex, 1);
    } else {
      snapshot[stopIndex] = { ...snapshot[stopIndex], change_type: 'removed' };
    }

    await query(
      `UPDATE schedule_routes
       SET stops_snapshot = $1
       WHERE id = $2`,
      [JSON.stringify(snapshot), scheduleRoute.id],
    );

    return json({ success: true });
  }

  if (request.method === 'POST' && scheduleId && suffix?.[0] === 'publish') {
    const schedule = await queryOne<{ id: string; status: string; name: string }>(
      `SELECT id, status, name FROM schedules WHERE id = $1`,
      [scheduleId],
    );
    if (!schedule) return error(404, 'Schedule not found');
    if (schedule.status !== 'draft') {
      return error(403, 'Only draft schedules can be published');
    }

    const scheduleRoutes = await query<{
      id: string;
      route_id: string;
      route_code: string;
      stops_snapshot: ScheduleStopSnapshotItem[];
    }>(
      `SELECT sr.id, sr.route_id, sr.stops_snapshot, r.route_code
       FROM schedule_routes sr
       JOIN routes r ON r.id = sr.route_id
       WHERE sr.schedule_id = $1`,
      [scheduleId],
    );

    const incompleteDetails: Array<{ route_code: string; sequences: number[] }> = [];
    for (const sr of scheduleRoutes) {
      const missing = sr.stops_snapshot
        .filter(
          (stop) =>
            (stop.change_type === 'updated' || stop.change_type === 'added') &&
            !stop.pickup_time &&
            stop.is_pickup_enabled,
        )
        .map((stop) => stop.sequence);
      if (missing.length > 0) {
        incompleteDetails.push({ route_code: sr.route_code, sequences: missing });
      }
    }
    if (incompleteDetails.length > 0) {
      return json(
        {
          error: 'Pickup time not set',
          details: incompleteDetails,
        },
        { status: 400 },
      );
    }

    const now = new Date();

    await withTransaction(async (client) => {
      await client.query('SET CONSTRAINTS ALL DEFERRED');

      for (const sr of scheduleRoutes) {
        for (const stop of sr.stops_snapshot) {
          if (stop.change_type === 'removed') {
            if (stop.route_stop_id) {
              await client.query(
                `UPDATE route_stops
                 SET active = false, sequence = -(ABS(sequence) + 100000)
                 WHERE id = $1`,
                [stop.route_stop_id],
              );
            }
            continue;
          }

          const placeResult = await client
            .query<{ id: string }>(
              `INSERT INTO places
                 (id, google_place_id, name, display_name, formatted_address, lat, lng,
                  place_types, notes, is_terminal, stop_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
               ON CONFLICT (google_place_id) DO UPDATE SET
                 name = EXCLUDED.name,
                 formatted_address = EXCLUDED.formatted_address,
                 lat = EXCLUDED.lat,
                 lng = EXCLUDED.lng,
                 place_types = EXCLUDED.place_types,
                 display_name = EXCLUDED.display_name,
                 notes = COALESCE(EXCLUDED.notes, places.notes),
                 is_terminal = EXCLUDED.is_terminal,
                 stop_id = COALESCE(EXCLUDED.stop_id, places.stop_id)
               RETURNING id`,
              [
                stop.place_id ?? randomUUID(),
                stop.google_place_id,
                stop.place_name,
                stop.place_display_name,
                stop.formatted_address,
                stop.lat,
                stop.lng,
                stop.place_types,
                stop.place_notes,
                stop.is_terminal,
                stop.stop_id,
              ],
            )
            .then((result) => result.rows[0]!);

          if (stop.route_stop_id) {
            await client.query(
              `UPDATE route_stops
               SET place_id = $1, sequence = $2, pickup_time = $3,
                   notes = $4, is_pickup_enabled = $5, active = true
               WHERE id = $6`,
              [
                placeResult.id,
                stop.sequence,
                stop.pickup_time,
                stop.notes,
                stop.is_pickup_enabled,
                stop.route_stop_id,
              ],
            );
          } else {
            await client.query(
              `INSERT INTO route_stops
                 (id, route_id, place_id, sequence, pickup_time, notes, is_pickup_enabled, active)
               VALUES ($1, $2, $3, $4, $5, $6, $7, true)
               ON CONFLICT (route_id, place_id)
               DO UPDATE SET
                 sequence = EXCLUDED.sequence,
                 pickup_time = EXCLUDED.pickup_time,
                 notes = EXCLUDED.notes,
                 is_pickup_enabled = EXCLUDED.is_pickup_enabled,
                 active = true`,
              [
                randomUUID(),
                sr.route_id,
                placeResult.id,
                stop.sequence,
                stop.pickup_time,
                stop.notes,
                stop.is_pickup_enabled,
              ],
            );
          }
        }

        await client.query(
          `UPDATE routes SET sync_status = 'synced', last_synced_at = $1 WHERE id = $2`,
          [now, sr.route_id],
        );
      }

      const routeIds = scheduleRoutes.map((sr) => sr.route_id);
      if (routeIds.length > 0) {
        const placeholders = routeIds.map((_, i) => `$${i + 1}`).join(',');
        await client.query(
          `UPDATE routes SET active = true WHERE id IN (${placeholders}) AND active = false`,
          routeIds,
        );
      }

      await client.query(
        `UPDATE schedules SET status = 'archived' WHERE status = 'published'`,
      );
      await client.query(
        `UPDATE schedules
         SET status = 'published', published_at = $1, published_by = $2
         WHERE id = $3`,
        [now, actor.userId, scheduleId],
      );
    });

    return json({
      success: true,
      name: schedule.name,
      published_at: now.toISOString(),
    });
  }

  if (request.method === 'POST' && scheduleId && suffix?.[0] === 'restore') {
    const schedule = await queryOne<{ id: string; status: string; name: string }>(
      `SELECT id, status, name FROM schedules WHERE id = $1`,
      [scheduleId],
    );
    if (!schedule) return error(404, 'Schedule not found');
    if (schedule.status !== 'archived') {
      return error(403, 'Only archived schedules can be restored');
    }

    const scheduleRoutes = await query<{
      id: string;
      route_id: string;
      stops_snapshot: ScheduleStopSnapshotItem[];
    }>(
      `SELECT sr.id, sr.route_id, sr.stops_snapshot
       FROM schedule_routes sr
       WHERE sr.schedule_id = $1`,
      [scheduleId],
    );

    const now = new Date();

    await withTransaction(async (client) => {
      await client.query('SET CONSTRAINTS ALL DEFERRED');

      for (const sr of scheduleRoutes) {
        for (const stop of sr.stops_snapshot) {
          if (stop.change_type === 'removed') {
            if (stop.route_stop_id) {
              await client.query(
                `UPDATE route_stops
                 SET active = false, sequence = -(ABS(sequence) + 100000)
                 WHERE id = $1`,
                [stop.route_stop_id],
              );
            }
            continue;
          }

          const placeResult = await client
            .query<{ id: string }>(
              `INSERT INTO places
                 (id, google_place_id, name, display_name, formatted_address, lat, lng,
                  place_types, notes, is_terminal, stop_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
               ON CONFLICT (google_place_id) DO UPDATE SET
                 name = EXCLUDED.name,
                 formatted_address = EXCLUDED.formatted_address,
                 lat = EXCLUDED.lat,
                 lng = EXCLUDED.lng,
                 place_types = EXCLUDED.place_types,
                 display_name = EXCLUDED.display_name,
                 notes = COALESCE(EXCLUDED.notes, places.notes),
                 is_terminal = EXCLUDED.is_terminal,
                 stop_id = COALESCE(EXCLUDED.stop_id, places.stop_id)
               RETURNING id`,
              [
                stop.place_id ?? randomUUID(),
                stop.google_place_id,
                stop.place_name,
                stop.place_display_name,
                stop.formatted_address,
                stop.lat,
                stop.lng,
                stop.place_types,
                stop.place_notes,
                stop.is_terminal,
                stop.stop_id,
              ],
            )
            .then((result) => result.rows[0]!);

          if (stop.route_stop_id) {
            await client.query(
              `UPDATE route_stops
               SET place_id = $1, sequence = $2, pickup_time = $3,
                   notes = $4, is_pickup_enabled = $5, active = true
               WHERE id = $6`,
              [
                placeResult.id,
                stop.sequence,
                stop.pickup_time,
                stop.notes,
                stop.is_pickup_enabled,
                stop.route_stop_id,
              ],
            );
          } else {
            await client.query(
              `INSERT INTO route_stops
                 (id, route_id, place_id, sequence, pickup_time, notes, is_pickup_enabled, active)
               VALUES ($1, $2, $3, $4, $5, $6, $7, true)
               ON CONFLICT (route_id, place_id)
               DO UPDATE SET
                 sequence = EXCLUDED.sequence,
                 pickup_time = EXCLUDED.pickup_time,
                 notes = EXCLUDED.notes,
                 is_pickup_enabled = EXCLUDED.is_pickup_enabled,
                 active = true`,
              [
                randomUUID(),
                sr.route_id,
                placeResult.id,
                stop.sequence,
                stop.pickup_time,
                stop.notes,
                stop.is_pickup_enabled,
              ],
            );
          }
        }

        await client.query(
          `UPDATE routes SET sync_status = 'synced', last_synced_at = $1 WHERE id = $2`,
          [now, sr.route_id],
        );
      }

      await client.query(
        `UPDATE schedules SET status = 'archived' WHERE status = 'published'`,
      );
      await client.query(
        `UPDATE schedules
         SET status = 'published', published_at = $1, published_by = $2
         WHERE id = $3`,
        [now, actor.userId, scheduleId],
      );
    });

    return json({
      success: true,
      name: schedule.name,
      published_at: now.toISOString(),
      restored: true,
    });
  }

  if (
    request.method === 'DELETE' &&
    scheduleId &&
    (!suffix || suffix.length === 0)
  ) {
    const schedule = await queryOne<{ id: string; status: string }>(
      `SELECT id, status FROM schedules WHERE id = $1`,
      [scheduleId],
    );
    if (!schedule) return error(404, 'Schedule not found');
    if (schedule.status !== 'draft') {
      return error(403, 'Only draft schedules can be deleted');
    }

    await withTransaction(async (client) => {
      await client.query(`DELETE FROM schedule_routes WHERE schedule_id = $1`, [scheduleId]);
      await client.query(`DELETE FROM schedules WHERE id = $1`, [scheduleId]);
    });

    return json({ success: true, id: scheduleId });
  }

  if (request.method === 'GET' && scheduleId && (!suffix || suffix.length === 0)) {
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

export async function handleAdminRuns(request: NextRequest, runId?: string, suffix?: string[]) {
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

  if (request.method === 'DELETE' && runId && (!suffix || suffix.length === 0)) {
    if (actor.role !== 'admin') return error(403, 'Admin role required');

    const run = await queryOne<RunRow>(
      `SELECT * FROM shuttle_runs WHERE id = $1`,
      [runId],
    );
    if (!run) return error(404, 'Run not found');
    if (run.status === 'active') {
      return error(409, 'Active run cannot be deleted');
    }

    const scanCount = await queryOne<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM scan_events WHERE run_id = $1`,
      [runId],
    );
    if ((scanCount?.count ?? 0) > 0) {
      return error(409, 'Run with scan events cannot be deleted');
    }

    await query(`DELETE FROM admin_stop_overrides WHERE run_id = $1`, [runId]);
    const deleted = await queryOne<{ id: string }>(
      `DELETE FROM shuttle_runs WHERE id = $1 RETURNING id`,
      [runId],
    );
    if (!deleted) return error(404, 'Run not found');
    return json({ success: true, id: runId });
  }

  if (
    request.method === 'PATCH' &&
    runId &&
    suffix?.[0] === 'stops' &&
    suffix?.[1]
  ) {
    const stopId = suffix[1];
    const body = (await request.json()) as {
      status?: 'arrived' | 'waiting';
      total_passengers_override?: number | null;
      reset?: boolean;
    };

    const run = await queryOne<{ id: string; route_id: string }>(
      `SELECT id, route_id
       FROM shuttle_runs
       WHERE id = $1 AND status = 'active'`,
      [runId],
    );
    if (!run) return error(404, 'Active run not found');

    const routeStop = await queryOne<{ id: string }>(
      `SELECT id
       FROM route_stops
       WHERE id = $1 AND route_id = $2`,
      [stopId, run.route_id],
    );
    if (!routeStop) return error(404, 'Route stop not found for this run');

    if (body.reset) {
      await query(
        `DELETE FROM admin_stop_overrides
         WHERE run_id = $1 AND route_stop_id = $2`,
        [runId, stopId],
      );
      return json({ run_id: runId, route_stop_id: stopId, reset: true });
    }

    if (body.status !== 'arrived' && body.status !== 'waiting') {
      return error(400, "status must be 'arrived' or 'waiting'");
    }

    if (
      body.total_passengers_override !== undefined &&
      body.total_passengers_override !== null &&
      (!Number.isInteger(body.total_passengers_override) ||
        body.total_passengers_override < 0)
    ) {
      return error(
        400,
        'total_passengers_override must be a non-negative integer',
      );
    }

    await query(
      `INSERT INTO admin_stop_overrides
         (run_id, route_stop_id, status, total_passengers_override, set_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (run_id, route_stop_id) DO UPDATE
       SET status = EXCLUDED.status,
           total_passengers_override = EXCLUDED.total_passengers_override,
           set_by = EXCLUDED.set_by,
           set_at = NOW()`,
      [
        runId,
        stopId,
        body.status,
        body.total_passengers_override ?? null,
        actor.userId,
      ],
    );

    if (body.status === 'arrived') {
      notifyApproachingUsers(runId, stopId).catch((caught) => {
        console.error('[admin-runs] notifyApproachingUsers failed', {
          runId,
          stopId,
          message: caught instanceof Error ? caught.message : String(caught),
        });
      });
    }

    return json({
      run_id: runId,
      route_stop_id: stopId,
      status: body.status,
      total_passengers_override: body.total_passengers_override ?? null,
    });
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
