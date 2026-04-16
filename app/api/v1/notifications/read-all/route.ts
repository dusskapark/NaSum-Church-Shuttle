import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/server/db';
import { requireActor, json } from '@/server/http';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest) {
  const actor = await requireActor(request);
  if (actor instanceof NextResponse) return actor;

  await query(
    `UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`,
    [actor.userId],
  );

  return json({ success: true });
}
