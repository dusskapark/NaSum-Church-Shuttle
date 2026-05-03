import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/server/db';
import { error, json, requireActor } from '@/server/http';
import { logError } from '@/lib/logger';
import { enqueueApproachingUsersPushJob } from '@/server/push-jobs';

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

export async function handleAdminRuns(
  request: NextRequest,
  runId?: string,
  suffix?: string[],
) {
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
      try {
        await enqueueApproachingUsersPushJob(runId, stopId);
      } catch (caught) {
        logError('[admin-runs] enqueueApproachingUsersPushJob failed', {
          runId,
          stopId,
          message: caught instanceof Error ? caught.message : String(caught),
        });
      }
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
    const stopIds = await query<{ id: string; stop_name: string }>(
      `SELECT
         rs.id,
         COALESCE(NULLIF(p.display_name, ''), NULLIF(p.name, ''), CONCAT('Stop ', rs.sequence::text)) AS stop_name
       FROM route_stops rs
       JOIN places p ON p.id = rs.place_id
       WHERE rs.route_id = $1
       ORDER BY rs.sequence ASC`,
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
    const stopResults = stopIds.map(({ id, stop_name }) => {
      const riders = ridersByStop.get(id) ?? [];
      return {
        route_stop_id: id,
        stop_name,
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
