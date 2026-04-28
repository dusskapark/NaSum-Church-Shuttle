import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { query, withTransaction } from '@/server/db';
import { json, error, requireActor } from '@/server/http';
import { logError } from '@/lib/logger';
import { notifyApproachingUsers } from '@/server/notifications';
import type { RunRow } from './_shared';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
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

    const idempotencyKey = `${actor.userId}:${body.run_id}`;
    const newId = randomUUID();
    await client.query(
      `INSERT INTO scan_events
         (id, user_id, run_id, route_stop_id, result_code, additional_passengers, idempotency_key)
       VALUES ($1, $2, $3, $4, 'ok', $5, $6)
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [
        newId,
        actor.userId,
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
    const isNewCheckin = row.id === newId;
    const count = await client
      .query<{ total: bigint | number }>(
        `SELECT COALESCE(SUM(1 + additional_passengers), 0) AS total
         FROM scan_events WHERE run_id = $1 AND route_stop_id = $2`,
        [body.run_id, body.route_stop_id],
      )
      .then((res) => res.rows[0]);

    return {
      success: true,
      is_new_checkin: isNewCheckin,
      checkin_id: row.id,
      stop_state: {
        route_stop_id: body.route_stop_id,
        total_passengers: Number(count?.total ?? 0),
        status: 'arrived',
      },
    };
  }).catch((caught: unknown) => {
    const status = (caught as { status?: number }).status ?? 500;
    const message = caught instanceof Error ? caught.message : 'Check-in failed';
    return error(status, message);
  });

  if (response instanceof NextResponse) return response;

  if (response.is_new_checkin) {
    notifyApproachingUsers(body.run_id, body.route_stop_id).catch((caught) => {
      logError('[checkin] notifyApproachingUsers failed', {
        runId: body.run_id,
        routeStopId: body.route_stop_id,
        message: caught instanceof Error ? caught.message : String(caught),
      });
    });
  }

  return json({
    success: true,
    checkin_id: response.checkin_id,
    stop_state: response.stop_state,
  });
}
