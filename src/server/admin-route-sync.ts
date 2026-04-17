import { randomUUID } from 'node:crypto';
import { query, withTransaction } from './db';
import {
  parseGoogleMapsUrl,
  resolveWaypoint,
  type PlaceResult,
} from './google-places';

export interface ScheduleStopSnapshotItem {
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

export async function fetchRouteStopSnapshotRows(
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

export function toScheduleSnapshot(
  stop: RouteStopSnapshotRow,
): ScheduleStopSnapshotItem {
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

export function normalizeSnapshotSequences(
  snapshot: ScheduleStopSnapshotItem[],
): ScheduleStopSnapshotItem[] {
  return snapshot
    .map((stop, index) => ({
      ...stop,
      sequence: index + 1,
    }))
    .sort((a, b) => a.sequence - b.sequence);
}

export async function buildLiveRouteSnapshot(
  routeId: string,
): Promise<ScheduleStopSnapshotItem[]> {
  const stopRows = await fetchRouteStopSnapshotRows(routeId);
  return stopRows.filter((row) => row.active).map(toScheduleSnapshot);
}

export async function syncRouteSnapshot(
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

export async function applySyncedSnapshotToRoute(
  routeId: string,
  snapshot: ScheduleStopSnapshotItem[],
) {
  await withTransaction(async (client) => {
    await client.query('SET CONSTRAINTS ALL DEFERRED');

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
