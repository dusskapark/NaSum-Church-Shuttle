import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/server/db';
import { error, json, requireActor } from '@/server/http';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const actor = await requireActor(request, 'admin');
  if (actor instanceof NextResponse) return actor;

  const row = await queryOne(
    `SELECT id, enabled, days_of_week, start_time, end_time, updated_at, updated_by
     FROM auto_run_config WHERE id = 'singleton'`,
  );
  if (!row) return error(500, 'Config row missing');
  return json(row);
}

export async function PUT(request: NextRequest) {
  const actor = await requireActor(request, 'admin');
  if (actor instanceof NextResponse) return actor;

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
