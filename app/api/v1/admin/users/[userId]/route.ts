import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/server/db';
import { error, json, requireActor } from '@/server/http';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const actor = await requireActor(request, 'admin');
  if (actor instanceof NextResponse) return actor;

  const { userId } = await params;
  const updated = await queryOne<{ id: string }>(
    `UPDATE users
     SET role = 'rider'
     WHERE id = $1 AND role IN ('admin', 'driver')
     RETURNING id`,
    [userId],
  );
  if (!updated) return error(404, 'Privileged user not found');
  return json({ success: true, id: userId });
}
