import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, withTransaction } from '@/server/db';
import { error, json, requireActor } from '@/server/http';
import { env } from '@/server/env';
import { getPlaceById } from '@/server/google-places';
import type { ScheduleStopSnapshotItem } from '@/server/admin-route-sync';

interface PlaceLookupResponse {
  google_place_id: string;
  name: string;
  display_name: string | null;
  formatted_address: string | null;
  lat: number;
  lng: number;
  place_types: string[];
  is_terminal: boolean;
  stop_id: string | null;
}

interface PlaceRow extends PlaceLookupResponse {
  id: string;
  notes: string | null;
  route_stop_count: number;
  schedule_snapshot_count: number;
  duplicate_candidate_count: number;
}

interface PlaceMetadata {
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
}

const PLACE_LIST_SELECT = `
  WITH place_rows AS (
    SELECT
      p.id,
      p.google_place_id,
      p.name,
      p.display_name,
      p.formatted_address,
      p.lat,
      p.lng,
      p.place_types,
      p.notes,
      p.is_terminal,
      p.stop_id,
      COALESCE(route_usage.route_stop_count, 0)::int AS route_stop_count,
      COALESCE(schedule_usage.schedule_snapshot_count, 0)::int AS schedule_snapshot_count,
      (
        SELECT COUNT(*)::int
        FROM places candidate
        WHERE candidate.id <> p.id
          AND (
            (
              NULLIF(TRIM(COALESCE(p.stop_id, '')), '') IS NOT NULL
              AND LOWER(candidate.stop_id) = LOWER(p.stop_id)
            )
            OR (
              REGEXP_REPLACE(LOWER(COALESCE(candidate.display_name, candidate.name)), '\\s+', '', 'g')
                = REGEXP_REPLACE(LOWER(COALESCE(p.display_name, p.name)), '\\s+', '', 'g')
            )
            OR (
              ABS(candidate.lat - p.lat) < 0.00025
              AND ABS(candidate.lng - p.lng) < 0.00025
            )
          )
      ) AS duplicate_candidate_count
    FROM places p
    LEFT JOIN (
      SELECT place_id, COUNT(*)::int AS route_stop_count
      FROM route_stops
      GROUP BY place_id
    ) route_usage ON route_usage.place_id = p.id
    LEFT JOIN (
      SELECT p_inner.id AS place_id, COUNT(*)::int AS schedule_snapshot_count
      FROM places p_inner
      JOIN schedule_routes sr ON EXISTS (
        SELECT 1
        FROM jsonb_array_elements(sr.stops_snapshot) AS stop
        WHERE stop->>'place_id' = p_inner.id
          OR stop->>'google_place_id' = p_inner.google_place_id
      )
      GROUP BY p_inner.id
    ) schedule_usage ON schedule_usage.place_id = p.id
  )
`;

function placeListWhere(searchParam = '$1', duplicateParam = '$2') {
  return `
    WHERE (
      ${searchParam} = ''
      OR CONCAT_WS(' ',
        name,
        COALESCE(display_name, ''),
        COALESCE(stop_id, ''),
        google_place_id,
        COALESCE(formatted_address, '')
      ) ILIKE '%' || ${searchParam} || '%'
    )
    AND (${duplicateParam} = false OR duplicate_candidate_count > 0)
  `;
}

function serializePlace(row: PlaceRow) {
  return {
    ...row,
    lat: Number(row.lat),
    lng: Number(row.lng),
    place_types: row.place_types ?? [],
    route_stop_count: Number(row.route_stop_count ?? 0),
    schedule_snapshot_count: Number(row.schedule_snapshot_count ?? 0),
    duplicate_candidate_count: Number(row.duplicate_candidate_count ?? 0),
  };
}

function applyPlaceMetadataToSnapshot(
  snapshot: ScheduleStopSnapshotItem[],
  match: { placeIds: Set<string>; googlePlaceIds: Set<string> },
  place: PlaceMetadata,
) {
  let changed = false;
  const next = snapshot.map((stop) => {
    const matchesPlace = stop.place_id ? match.placeIds.has(stop.place_id) : false;
    const matchesGoogle = match.googlePlaceIds.has(stop.google_place_id);
    if (!matchesPlace && !matchesGoogle) return stop;

    changed = true;
    return {
      ...stop,
      place_id: place.id,
      google_place_id: place.google_place_id,
      place_name: place.name,
      place_display_name: place.display_name,
      formatted_address: place.formatted_address,
      lat: Number(place.lat),
      lng: Number(place.lng),
      place_types: place.place_types ?? [],
      place_notes: place.notes,
      is_terminal: place.is_terminal,
      stop_id: place.stop_id,
    };
  });

  return changed ? next : null;
}

async function updateScheduleSnapshotsForPlace(
  client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<{ id: string; stops_snapshot: ScheduleStopSnapshotItem[] | null }> }> },
  match: { placeIds: Set<string>; googlePlaceIds: Set<string> },
  place: PlaceMetadata,
) {
  const placeIds = Array.from(match.placeIds);
  const googlePlaceIds = Array.from(match.googlePlaceIds);
  const rows = await client
    .query(
      `SELECT id, stops_snapshot
       FROM schedule_routes
       WHERE EXISTS (
         SELECT 1
         FROM jsonb_array_elements(stops_snapshot) AS stop
         WHERE stop->>'place_id' = ANY($1::text[])
            OR stop->>'google_place_id' = ANY($2::text[])
       )`,
      [placeIds, googlePlaceIds],
    )
    .then((result) => result.rows);

  for (const row of rows) {
    const next = applyPlaceMetadataToSnapshot(row.stops_snapshot ?? [], match, place);
    if (!next) continue;
    await client.query(`UPDATE schedule_routes SET stops_snapshot = $1 WHERE id = $2`, [
      JSON.stringify(next),
      row.id,
    ]);
  }
}

async function upsertPlaceFromLookup(
  input: PlaceLookupResponse,
): Promise<PlaceLookupResponse & { id: string }> {
  const row = await queryOne<PlaceLookupResponse & { id: string }>(
    `INSERT INTO places
       (id, google_place_id, name, display_name, formatted_address, primary_type, primary_type_display_name, lat, lng, place_types, notes, is_terminal, stop_id)
     VALUES
       ($1, $2, $3, $4, $5, NULL, NULL, $6, $7, $8, NULL, $9, $10)
     ON CONFLICT (google_place_id)
     DO UPDATE SET
       name = EXCLUDED.name,
       display_name = COALESCE(places.display_name, EXCLUDED.display_name),
       formatted_address = EXCLUDED.formatted_address,
       lat = EXCLUDED.lat,
       lng = EXCLUDED.lng,
       place_types = EXCLUDED.place_types
     RETURNING id, google_place_id, name, display_name, formatted_address, lat, lng, place_types, is_terminal, stop_id`,
    [
      randomUUID(),
      input.google_place_id,
      input.name,
      input.display_name,
      input.formatted_address,
      input.lat,
      input.lng,
      input.place_types ?? [],
      input.is_terminal,
      input.stop_id,
    ],
  );

  if (!row) throw new Error('Failed to upsert place');
  return row;
}

export async function handleAdminPlaces(
  request: NextRequest,
  suffix?: string[],
) {
  const actor = await requireActor(request, 'admin');
  if (actor instanceof NextResponse) return actor;

  if (request.method === 'GET' && (!suffix || suffix.length === 0)) {
    const search = request.nextUrl.searchParams.get('q')?.trim() ?? '';
    const duplicatesOnly = request.nextUrl.searchParams.get('duplicates') === 'true';
    const rows = await query<PlaceRow>(
      `${PLACE_LIST_SELECT}
       SELECT *
       FROM place_rows
       ${placeListWhere()}
       ORDER BY duplicate_candidate_count DESC, COALESCE(display_name, name) ASC, google_place_id ASC
       LIMIT 100`,
      [search, duplicatesOnly],
    );

    return json({ items: rows.map(serializePlace) });
  }

  if (request.method === 'GET' && suffix?.[0] && !suffix[1]) {
    const placeId = suffix[0];
    const place = await queryOne<PlaceRow>(
      `${PLACE_LIST_SELECT}
       SELECT *
       FROM place_rows
       WHERE id = $1`,
      [placeId],
    );
    if (!place) return error(404, 'Place not found');

    const routeUsages = await query(
      `SELECT
         rs.id AS route_stop_id,
         r.id AS route_id,
         r.route_code,
         COALESCE(r.display_name, r.name) AS route_title,
         rs.sequence,
         rs.pickup_time,
         rs.active
       FROM route_stops rs
       JOIN routes r ON r.id = rs.route_id
       WHERE rs.place_id = $1
       ORDER BY r.line, r.service, r.route_code, rs.sequence`,
      [placeId],
    );

    const scheduleUsages = await query(
      `SELECT
         s.id AS schedule_id,
         s.name AS schedule_name,
         s.status,
         r.id AS route_id,
         r.route_code,
         (stop->>'sequence')::int AS sequence,
         stop->>'change_type' AS change_type
       FROM schedule_routes sr
       JOIN schedules s ON s.id = sr.schedule_id
       JOIN routes r ON r.id = sr.route_id
       CROSS JOIN LATERAL jsonb_array_elements(sr.stops_snapshot) AS stop
       WHERE stop->>'place_id' = $1 OR stop->>'google_place_id' = $2
       ORDER BY s.published_at DESC NULLS LAST, s.created_at DESC, r.route_code, sequence
       LIMIT 80`,
      [placeId, place.google_place_id],
    );

    return json({
      ...serializePlace(place),
      route_usages: routeUsages,
      schedule_usages: scheduleUsages,
    });
  }

  if (request.method === 'GET' && suffix?.[0] && suffix?.[1] === 'duplicates') {
    const placeId = suffix[0];
    const place = await queryOne<PlaceMetadata>(
      `SELECT id, google_place_id, name, display_name, formatted_address, lat, lng,
              place_types, notes, is_terminal, stop_id
       FROM places
       WHERE id = $1`,
      [placeId],
    );
    if (!place) return error(404, 'Place not found');

    const rows = await query<PlaceRow>(
      `${PLACE_LIST_SELECT}
       SELECT *
       FROM place_rows
       WHERE id <> $1
         AND (
           (
             NULLIF(TRIM(COALESCE($2, '')), '') IS NOT NULL
             AND LOWER(stop_id) = LOWER($2)
           )
           OR (
             REGEXP_REPLACE(LOWER(COALESCE(display_name, name)), '\\s+', '', 'g')
               = REGEXP_REPLACE(LOWER($3), '\\s+', '', 'g')
           )
           OR (
             ABS(lat - $4) < 0.00025
             AND ABS(lng - $5) < 0.00025
           )
         )
       ORDER BY duplicate_candidate_count DESC, COALESCE(display_name, name) ASC, google_place_id ASC
       LIMIT 30`,
      [
        place.id,
        place.stop_id,
        place.display_name ?? place.name,
        Number(place.lat),
        Number(place.lng),
      ],
    );

    return json({ items: rows.map(serializePlace) });
  }

  if (request.method === 'PATCH' && suffix?.[0] && !suffix[1]) {
    const placeId = suffix[0];
    const body = (await request.json()) as {
      display_name?: string | null;
      notes?: string | null;
      is_terminal?: boolean;
      stop_id?: string | null;
    };

    const updates: string[] = [];
    const params: unknown[] = [];
    let index = 1;

    if (body.display_name !== undefined) {
      updates.push(`display_name = $${index++}`);
      params.push(body.display_name);
    }
    if (body.notes !== undefined) {
      updates.push(`notes = $${index++}`);
      params.push(body.notes);
    }
    if (body.is_terminal !== undefined) {
      updates.push(`is_terminal = $${index++}`);
      params.push(body.is_terminal);
    }
    if (body.stop_id !== undefined) {
      updates.push(`stop_id = $${index++}`);
      params.push(body.stop_id);
    }

    if (updates.length === 0) return error(400, 'No fields to update');

    const updated = await withTransaction(async (client) => {
      params.push(placeId);
      const place = await client
        .query<PlaceMetadata>(
          `UPDATE places
           SET ${updates.join(', ')}
           WHERE id = $${index}
           RETURNING id, google_place_id, name, display_name, formatted_address, lat, lng,
                     place_types, notes, is_terminal, stop_id`,
          params,
        )
        .then((result) => result.rows[0] ?? null);

      if (!place) return null;

      await updateScheduleSnapshotsForPlace(
        client,
        { placeIds: new Set([place.id]), googlePlaceIds: new Set([place.google_place_id]) },
        place,
      );

      return place;
    });

    if (!updated) return error(404, 'Place not found');
    return json({ success: true, id: updated.id });
  }

  if (request.method === 'POST' && suffix?.[0] && suffix?.[1] === 'merge') {
    const canonicalPlaceId = suffix[0];
    const body = (await request.json()) as { duplicate_place_id?: string };
    const duplicatePlaceId = body.duplicate_place_id?.trim() ?? '';
    if (!duplicatePlaceId) return error(400, 'duplicate_place_id is required');
    if (duplicatePlaceId === canonicalPlaceId) {
      return error(400, 'Cannot merge a place into itself');
    }

    const result = await withTransaction(async (client) => {
      const canonical = await client
        .query<PlaceMetadata>(
          `SELECT id, google_place_id, name, display_name, formatted_address, lat, lng,
                  place_types, notes, is_terminal, stop_id
           FROM places
           WHERE id = $1`,
          [canonicalPlaceId],
        )
        .then((response) => response.rows[0] ?? null);
      const duplicate = await client
        .query<PlaceMetadata>(
          `SELECT id, google_place_id, name, display_name, formatted_address, lat, lng,
                  place_types, notes, is_terminal, stop_id
           FROM places
           WHERE id = $1`,
          [duplicatePlaceId],
        )
        .then((response) => response.rows[0] ?? null);

      if (!canonical || !duplicate) {
        return { missing: true };
      }

      const conflicts = await client
        .query(
          `SELECT DISTINCT
             r.id AS route_id,
             r.route_code,
             COALESCE(r.display_name, r.name) AS route_title
           FROM route_stops duplicate_stop
           JOIN route_stops canonical_stop
             ON canonical_stop.route_id = duplicate_stop.route_id
            AND canonical_stop.place_id = $1
           JOIN routes r ON r.id = duplicate_stop.route_id
           WHERE duplicate_stop.place_id = $2
           ORDER BY r.route_code`,
          [canonical.id, duplicate.id],
        )
        .then((response) => response.rows);

      if (conflicts.length > 0) {
        return { conflicts };
      }

      const updatedRouteStops = await client
        .query<{ id: string }>(
          `UPDATE route_stops
           SET place_id = $1
           WHERE place_id = $2
           RETURNING id`,
          [canonical.id, duplicate.id],
        )
        .then((response) => response.rows.length);

      await updateScheduleSnapshotsForPlace(
        client,
        {
          placeIds: new Set([duplicate.id]),
          googlePlaceIds: new Set([duplicate.google_place_id]),
        },
        canonical,
      );

      await client.query(`DELETE FROM places WHERE id = $1`, [duplicate.id]);

      return { merged: true, updatedRouteStops };
    });

    if ('missing' in result) return error(404, 'Place not found');
    if ('conflicts' in result) {
      return json(
        {
          error: 'Merge conflict. Remove the duplicate stop from these routes first.',
          conflicts: result.conflicts,
        },
        { status: 409 },
      );
    }

    return json({
      success: true,
      id: canonicalPlaceId,
      updated_route_stop_count: result.updatedRouteStops,
    });
  }

  if (request.method === 'GET' && suffix?.[0] === 'lookup' && suffix?.[1]) {
    let googlePlaceId = '';
    try {
      googlePlaceId = decodeURIComponent(suffix[1]).trim();
    } catch {
      return error(400, 'invalid place id');
    }
    if (!googlePlaceId || !/^[-_a-zA-Z0-9]+$/.test(googlePlaceId)) {
      return error(400, 'invalid place id');
    }

    const existing = await queryOne<PlaceLookupResponse>(
      `SELECT google_place_id, name, display_name, formatted_address, lat, lng, place_types, is_terminal, stop_id
       FROM places
       WHERE google_place_id = $1`,
      [googlePlaceId],
    );
    if (existing) return json(existing);

    const apiKey = env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) return error(500, 'GOOGLE_MAPS_API_KEY not configured');

    try {
      const place = await getPlaceById(googlePlaceId, apiKey);
      if (!place) return error(404, 'place not found');

      const upserted = await upsertPlaceFromLookup({
        google_place_id: place.googlePlaceId,
        name: place.name,
        display_name: place.name || null,
        formatted_address: place.formattedAddress,
        lat: place.lat,
        lng: place.lng,
        place_types: place.types ?? [],
        is_terminal: false,
        stop_id: null,
      });

      return json({
        google_place_id: upserted.google_place_id,
        name: upserted.name,
        display_name: upserted.display_name,
        formatted_address: upserted.formatted_address,
        lat: Number(upserted.lat),
        lng: Number(upserted.lng),
        place_types: upserted.place_types ?? [],
        is_terminal: upserted.is_terminal,
        stop_id: upserted.stop_id,
      });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      return error(502, `google api error: ${message}`);
    }
  }

  return error(405, 'Method not allowed');
}
