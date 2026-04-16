import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/server/db';
import { json, error, requireActor } from '@/server/http';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
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
