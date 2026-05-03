import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/server/db';
import { error, json, requireActor } from '@/server/http';
import { env } from '@/server/env';
import {
  applySyncedSnapshotToRoute,
  syncRouteSnapshot,
} from '@/server/admin-route-sync';

export async function handleAdminRoutes(
  request: NextRequest,
  routeId?: string,
  suffix?: string[],
) {
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
    if (!route.google_maps_url) {
      return error(400, 'Route has no Google Maps URL set');
    }

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

  if (
    request.method === 'PATCH' &&
    routeId &&
    suffix?.[0] === 'stops' &&
    suffix?.[1] &&
    (!suffix[2] || suffix[2] === 'full' || suffix[2] === 'place')
  ) {
    const stopId = suffix[1];
    const mode = suffix[2] ?? 'route-stop';
    const body = (await request.json()) as {
      sequence?: number;
      pickup_time?: string | null;
      notes?: string | null;
      is_pickup_enabled?: boolean;
      display_name?: string | null;
      place_notes?: string | null;
      google_place_id?: string | null;
      is_terminal?: boolean;
      stop_id?: string | null;
    };

    const stop = await queryOne<{ place_id: string }>(
      `SELECT place_id
       FROM route_stops
       WHERE id = $1 AND route_id = $2`,
      [stopId, routeId],
    );
    if (!stop) return error(404, 'Route stop not found');

    if (mode === 'route-stop' || mode === 'full') {
      const updates: string[] = [];
      const params: unknown[] = [];
      let index = 1;

      if (body.sequence !== undefined) {
        if (!Number.isInteger(body.sequence) || body.sequence <= 0) {
          return error(400, 'sequence must be a positive integer');
        }
        updates.push(`sequence = $${index++}`);
        params.push(body.sequence);
      }
      if (body.pickup_time !== undefined) {
        updates.push(`pickup_time = $${index++}`);
        params.push(body.pickup_time);
      }
      if (body.notes !== undefined) {
        updates.push(`notes = $${index++}`);
        params.push(body.notes);
      }
      if (body.is_pickup_enabled !== undefined) {
        updates.push(`is_pickup_enabled = $${index++}`);
        params.push(body.is_pickup_enabled);
      }

      if (updates.length > 0) {
        params.push(stopId, routeId);
        await query(
          `UPDATE route_stops
           SET ${updates.join(', ')}
           WHERE id = $${index++} AND route_id = $${index}`,
          params,
        );
      }
    }

    if (mode === 'place' || mode === 'full') {
      let targetPlaceId = stop.place_id;

      if (body.google_place_id !== undefined && body.google_place_id) {
        const existingPlace = await queryOne<{ id: string }>(
          `SELECT id FROM places WHERE google_place_id = $1`,
          [body.google_place_id],
        );
        if (existingPlace) {
          targetPlaceId = existingPlace.id;
          await query(
            `UPDATE route_stops
             SET place_id = $1
             WHERE id = $2 AND route_id = $3`,
            [targetPlaceId, stopId, routeId],
          );
        } else {
          await query(
            `UPDATE places
             SET google_place_id = $1
             WHERE id = $2`,
            [body.google_place_id, targetPlaceId],
          );
        }
      }

      const updates: string[] = [];
      const params: unknown[] = [];
      let index = 1;

      if (body.display_name !== undefined) {
        updates.push(`display_name = $${index++}`);
        params.push(body.display_name);
      }
      if (body.place_notes !== undefined) {
        updates.push(`notes = $${index++}`);
        params.push(body.place_notes);
      }
      if (body.is_terminal !== undefined) {
        updates.push(`is_terminal = $${index++}`);
        params.push(body.is_terminal);
      }
      if (body.stop_id !== undefined) {
        updates.push(`stop_id = $${index++}`);
        params.push(body.stop_id);
      }

      if (updates.length > 0) {
        params.push(targetPlaceId);
        await query(
          `UPDATE places
           SET ${updates.join(', ')}
           WHERE id = $${index}`,
          params,
        );
      }
    }

    return json({ success: true, route_stop_id: stopId });
  }

  if (
    request.method === 'DELETE' &&
    routeId &&
    suffix?.[0] === 'stops' &&
    suffix?.[1] &&
    !suffix[2]
  ) {
    const deleted = await queryOne<{ id: string }>(
      `UPDATE route_stops
       SET active = false
       WHERE id = $1 AND route_id = $2
       RETURNING id`,
      [suffix[1], routeId],
    );
    if (!deleted) return error(404, 'Route stop not found');
    return json({ success: true, id: suffix[1] });
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
