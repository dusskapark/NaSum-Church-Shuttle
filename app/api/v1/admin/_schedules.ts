import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, withTransaction } from '@/server/db';
import { error, json, requireActor } from '@/server/http';
import { env } from '@/server/env';
import {
  buildLiveRouteSnapshot,
  normalizeSnapshotSequences,
  syncRouteSnapshot,
  type ScheduleStopSnapshotItem,
} from '@/server/admin-route-sync';

function generateScheduleName(existingNames: string[]): string {
  const base = new Date().toISOString().slice(0, 10);
  if (!existingNames.includes(base)) return base;

  let suffix = 2;
  while (existingNames.includes(`${base} (${suffix})`)) {
    suffix += 1;
  }
  return `${base} (${suffix})`;
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
            change_type: 'unchanged' as const,
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
    request.method === 'GET' &&
    scheduleId &&
    suffix?.[0] === 'routes' &&
    suffix?.[1] &&
    suffix?.[2] === 'stops' &&
    suffix?.[3] === 'candidates'
  ) {
    const routeId = suffix[1];
    const queryText = request.nextUrl.searchParams.get('q')?.trim() ?? '';
    const queryTokens = queryText
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean);
    const compactQuery = queryText.toLowerCase().replace(/\s+/g, '');
    const queryPrefix = `${queryText}%`;

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

    const rows = await query<{
      id: string;
      google_place_id: string;
      name: string;
      display_name: string | null;
      formatted_address: string | null;
      lat: number;
      lng: number;
      place_types: string[];
      notes: string | null;
      is_terminal: boolean;
      stop_id: string | null;
      match_score: number;
    }>(
      `SELECT id, google_place_id, name, display_name, formatted_address, lat, lng, place_types, notes, is_terminal, stop_id,
              CASE
                WHEN LOWER(name) = LOWER($1)
                  OR LOWER(COALESCE(display_name, '')) = LOWER($1)
                  OR LOWER(COALESCE(stop_id, '')) = LOWER($1)
                THEN 500
                WHEN name ILIKE $4 OR COALESCE(display_name, '') ILIKE $4
                THEN 300
                WHEN CONCAT_WS(' ',
                  name,
                  COALESCE(display_name, ''),
                  COALESCE(stop_id, ''),
                  google_place_id,
                  COALESCE(formatted_address, ''),
                  COALESCE(array_to_string(place_types, ' '), '')
                ) ILIKE '%' || $1 || '%'
                THEN 200
                WHEN REPLACE(
                  LOWER(
                    CONCAT_WS('',
                      name,
                      COALESCE(display_name, ''),
                      COALESCE(stop_id, ''),
                      google_place_id,
                      COALESCE(formatted_address, ''),
                      COALESCE(array_to_string(place_types, ''), '')
                    )
                  ),
                  ' ',
                  ''
                ) LIKE '%' || $3 || '%'
                THEN 120
                ELSE 0
              END AS match_score
       FROM places
       WHERE (
         $1 = '' OR
         (
           NOT EXISTS (
             SELECT 1
             FROM UNNEST($2::text[]) AS token
             WHERE CONCAT_WS(' ',
               name,
               COALESCE(display_name, ''),
               COALESCE(stop_id, ''),
               google_place_id,
               COALESCE(formatted_address, ''),
               COALESCE(array_to_string(place_types, ' '), '')
             ) NOT ILIKE '%' || token || '%'
           )
           OR REPLACE(
             LOWER(
               CONCAT_WS('',
                 name,
                 COALESCE(display_name, ''),
                 COALESCE(stop_id, ''),
                 google_place_id,
                 COALESCE(formatted_address, ''),
                 COALESCE(array_to_string(place_types, ''), '')
               )
             ),
             ' ',
             ''
           ) LIKE '%' || $3 || '%'
         )
       )
       ORDER BY match_score DESC, COALESCE(display_name, name) ASC, google_place_id ASC
       LIMIT 30`,
      [queryText, queryTokens, compactQuery, queryPrefix],
    );

    const existing = new Set(
      (scheduleRoute.stops_snapshot ?? [])
        .filter((s) => s.change_type !== 'removed')
        .map((s) => s.google_place_id),
    );

    return json({
      items: rows.map((row) => ({
        ...row,
        already_in_route: existing.has(row.google_place_id),
      })),
    });
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
      move_to_sequence?: number;
      restore?: boolean;
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

    const snapshot = [...(scheduleRoute.stops_snapshot ?? [])].sort(
      (a, b) => a.sequence - b.sequence,
    );
    const stopIndex = snapshot.findIndex((stop) => stop.sequence === sequence);
    if (stopIndex === -1) return error(404, 'Stop not found in snapshot');

    if (body.restore) {
      const target = snapshot[stopIndex];
      if (target.change_type === 'removed') {
        snapshot[stopIndex] = {
          ...target,
          change_type: target.route_stop_id ? 'unchanged' : 'added',
        };

        await query(
          `UPDATE schedule_routes
           SET stops_snapshot = $1
           WHERE id = $2`,
          [JSON.stringify(snapshot), scheduleRoute.id],
        );
      }

      return json({ success: true });
    }

    if (body.move_to_sequence !== undefined) {
      if (
        !Number.isInteger(body.move_to_sequence) ||
        body.move_to_sequence <= 0 ||
        body.move_to_sequence > snapshot.length
      ) {
        return error(400, 'move_to_sequence must be a valid sequence number');
      }

      const [moved] = snapshot.splice(stopIndex, 1);
      snapshot.splice(body.move_to_sequence - 1, 0, moved);
      const normalized = normalizeSnapshotSequences(snapshot);

      await query(
        `UPDATE schedule_routes
         SET stops_snapshot = $1
         WHERE id = $2`,
        [JSON.stringify(normalized), scheduleRoute.id],
      );

      return json({ success: true });
    }

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

    const normalized = normalizeSnapshotSequences(snapshot);

    await query(
      `UPDATE schedule_routes
       SET stops_snapshot = $1
       WHERE id = $2`,
      [JSON.stringify(normalized), scheduleRoute.id],
    );

    return json({ success: true });
  }

  if (
    request.method === 'POST' &&
    scheduleId &&
    suffix?.[0] === 'routes' &&
    suffix?.[1] &&
    suffix?.[2] === 'stops'
  ) {
    const routeId = suffix[1];
    const body = (await request.json()) as {
      google_place_id?: string;
      place_name?: string;
      display_name?: string | null;
      formatted_address?: string | null;
      lat?: number;
      lng?: number;
      place_types?: string[];
      place_notes?: string | null;
      is_terminal?: boolean;
      stop_id?: string | null;
      pickup_time?: string | null;
      notes?: string | null;
      is_pickup_enabled?: boolean;
      insert_at_sequence?: number | null;
    };

    const googlePlaceId = body.google_place_id?.trim() ?? '';
    if (!googlePlaceId) return error(400, 'google_place_id is required');
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

    const snapshot = [...(scheduleRoute.stops_snapshot ?? [])].sort(
      (a, b) => a.sequence - b.sequence,
    );

    const existingIndex = snapshot.findIndex(
      (stop) => stop.google_place_id === googlePlaceId,
    );
    if (existingIndex >= 0) {
      if (snapshot[existingIndex].change_type === 'removed') {
        const restored = [...snapshot];
        const restoredStop = restored[existingIndex]!;
        restored[existingIndex] = {
          ...restoredStop,
          change_type: restoredStop.route_stop_id ? 'unchanged' : 'added',
        };

        await query(
          `UPDATE schedule_routes
           SET stops_snapshot = $1
           WHERE id = $2`,
          [JSON.stringify(restored), scheduleRoute.id],
        );

        return json({ success: true, restored: true });
      }
      return json({ error: 'Stop already exists in route' }, { status: 409 });
    }

    const place = await queryOne<{
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
      `SELECT id, name, display_name, formatted_address, lat, lng, place_types, notes, is_terminal, stop_id
       FROM places WHERE google_place_id = $1`,
      [googlePlaceId],
    );

    if (!place) {
      return error(400, 'Place metadata not found. Fetch place lookup first.');
    }

    const resolvedPlace = {
      place_id: place.id,
      place_name: place.name,
      place_display_name:
        body.display_name !== undefined ? body.display_name : place.display_name,
      formatted_address: place.formatted_address,
      lat: Number(place.lat),
      lng: Number(place.lng),
      place_types: place.place_types ?? [],
      place_notes: body.place_notes !== undefined ? body.place_notes : place.notes,
      is_terminal: body.is_terminal !== undefined ? body.is_terminal : place.is_terminal,
      stop_id: body.stop_id !== undefined ? body.stop_id : place.stop_id,
    };

    const insertAt =
      body.insert_at_sequence && Number.isInteger(body.insert_at_sequence)
        ? Math.min(Math.max(body.insert_at_sequence, 1), snapshot.length + 1)
        : snapshot.length + 1;

    const newStop: ScheduleStopSnapshotItem = {
      route_stop_id: null,
      sequence: insertAt,
      pickup_time: body.pickup_time ?? null,
      is_pickup_enabled: body.is_pickup_enabled ?? true,
      notes: body.notes ?? null,
      ...resolvedPlace,
      google_place_id: googlePlaceId,
      change_type: 'added',
    };

    snapshot.splice(insertAt - 1, 0, newStop);
    const normalized = normalizeSnapshotSequences(snapshot);

    await query(
      `UPDATE schedule_routes
       SET stops_snapshot = $1
       WHERE id = $2`,
      [JSON.stringify(normalized), scheduleRoute.id],
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

    const snapshot = [...(scheduleRoute.stops_snapshot ?? [])].sort(
      (a, b) => a.sequence - b.sequence,
    );
    const stopIndex = snapshot.findIndex((stop) => stop.sequence === sequence);
    if (stopIndex === -1) return error(404, 'Stop not found in snapshot');

    if (snapshot[stopIndex].change_type === 'added') {
      snapshot.splice(stopIndex, 1);
    } else {
      snapshot[stopIndex] = { ...snapshot[stopIndex], change_type: 'removed' };
    }

    const normalized = normalizeSnapshotSequences(snapshot);

    await query(
      `UPDATE schedule_routes
       SET stops_snapshot = $1
       WHERE id = $2`,
      [JSON.stringify(normalized), scheduleRoute.id],
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
        await client.query(
          `UPDATE route_stops
           SET sequence = -(ABS(sequence) + 100000)
           WHERE route_id = $1`,
          [sr.route_id],
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
            [sr.route_id],
          )
          .then((result) => result.rows);

        const existingByPlaceId = new Map(
          existingRows.map((row) => [row.google_place_id, row]),
        );
        const activeIds = new Set<string>();

        for (const stop of sr.stops_snapshot) {
          if (stop.change_type === 'removed') continue;

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

          const existing = existingByPlaceId.get(stop.google_place_id);
          const routeStopId = stop.route_stop_id ?? existing?.route_stop_id ?? randomUUID();

          await client.query(
            `INSERT INTO route_stops
               (id, route_id, place_id, sequence, pickup_time, notes, is_pickup_enabled, active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, true)
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
              sr.route_id,
              placeResult.id,
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
            [sr.route_id, Array.from(activeIds)],
          );
        } else {
          await client.query(
            `UPDATE route_stops
             SET active = false
             WHERE route_id = $1`,
            [sr.route_id],
          );
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
