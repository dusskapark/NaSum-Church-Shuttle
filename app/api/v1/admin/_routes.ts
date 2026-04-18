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
