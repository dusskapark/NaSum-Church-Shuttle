import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/server/db';
import { requireActor, json } from '@/server/http';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const actor = await requireActor(request);
  if (actor instanceof NextResponse) return actor;

  const row = await queryOne<{ unread_count: number }>(
    `SELECT COUNT(*)::int AS unread_count
     FROM notifications
     WHERE user_id = $1 AND is_read = false`,
    [actor.userId],
  );

  return json({ unread_count: Number(row?.unread_count ?? 0) });
}
