import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/server/db';
import { requireActor, json } from '@/server/http';

export const dynamic = 'force-dynamic';

interface NotificationRow {
  id: string;
  run_id: string;
  trigger_stop_id: string;
  stops_away: number;
  title_ko: string;
  body_ko: string;
  title_en: string;
  body_en: string;
  is_read: boolean;
  created_at: string;
  route_code: string | null;
  user_route_stop_id: string | null;
}

export async function GET(request: NextRequest) {
  const actor = await requireActor(request);
  if (actor instanceof NextResponse) return actor;

  const rows = await query<NotificationRow>(
    `SELECT id, run_id, trigger_stop_id, stops_away,
            title_ko, body_ko, title_en, body_en,
            is_read, created_at, route_code, user_route_stop_id
     FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [actor.userId],
  );

  return json(rows);
}
