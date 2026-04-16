import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/server/db';
import { json, error, requireActor } from '@/server/http';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest) {
  const actor = await requireActor(request);
  if (actor instanceof NextResponse) return actor;

  const body = (await request.json()) as {
    push_notifications_enabled?: boolean;
    preferred_language?: 'ko' | 'en';
  };

  const updates: string[] = [];
  const params: unknown[] = [];
  let index = 1;

  if (body.push_notifications_enabled !== undefined) {
    if (typeof body.push_notifications_enabled !== 'boolean') {
      return error(400, 'push_notifications_enabled must be a boolean');
    }
    updates.push(`push_notifications_enabled = $${index++}`);
    params.push(body.push_notifications_enabled);
  }

  if (body.preferred_language !== undefined) {
    if (body.preferred_language !== 'ko' && body.preferred_language !== 'en') {
      return error(400, "preferred_language must be 'ko' or 'en'");
    }
    updates.push(`preferred_language = $${index++}`);
    params.push(body.preferred_language);
  }

  if (updates.length === 0) {
    return error(
      400,
      'At least one of push_notifications_enabled or preferred_language is required',
    );
  }

  params.push(actor.userId);
  const updated = await queryOne<{
    push_notifications_enabled: boolean;
    preferred_language: 'ko' | 'en';
  }>(
    `UPDATE users
     SET ${updates.join(', ')}
     WHERE id = $${index}
     RETURNING push_notifications_enabled, preferred_language`,
    params,
  );
  if (!updated) return error(404, 'User not found');

  return json({
    success: true,
    push_notifications_enabled: updated.push_notifications_enabled,
    preferred_language: updated.preferred_language,
  });
}
