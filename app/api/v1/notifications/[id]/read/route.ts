import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/server/db';
import { error, requireActor, json } from '@/server/http';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const actor = await requireActor(request);
  if (actor instanceof NextResponse) return actor;

  const { id } = await params;
  const row = await queryOne<{ id: string }>(
    `UPDATE notifications SET is_read = true
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [id, actor.userId],
  );

  if (!row) return error(404, 'Notification not found');
  return json({ success: true });
}
