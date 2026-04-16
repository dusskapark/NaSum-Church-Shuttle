import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/server/db';
import { error, json, requireActor } from '@/server/http';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ registrationId: string }> },
) {
  const actor = await requireActor(request, 'admin');
  if (actor instanceof NextResponse) return actor;

  const { registrationId } = await params;
  const row = await queryOne<{ id: string }>(
    `DELETE FROM user_registrations WHERE id = $1 RETURNING id`,
    [registrationId],
  );
  if (!row) return error(404, 'Registration not found');
  return json({ success: true, id: registrationId });
}
