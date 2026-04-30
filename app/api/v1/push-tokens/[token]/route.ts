import { NextRequest, NextResponse } from 'next/server';
import { error, json, requireActor } from '@/server/http';
import { deactivateDevicePushToken } from '@/server/push-tokens';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const actor = await requireActor(request);
  if (actor instanceof NextResponse) return actor;

  const { token } = await context.params;
  let decodedToken = '';
  try {
    decodedToken = decodeURIComponent(token);
  } catch {
    return error(400, 'invalid token');
  }

  const deleted = await deactivateDevicePushToken({
    token: decodedToken,
    userId: actor.userId,
  });

  return json({
    success: true,
    deleted,
  });
}
