import { NextRequest, NextResponse } from 'next/server';
import { json, requireActor } from '@/server/http';
import { fetchActorProfile } from '@/server/users';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const actor = await requireActor(request);
  if (actor instanceof NextResponse) return actor;

  const profile = await fetchActorProfile(actor.userId, actor.identityId);
  if (!profile) {
    return json({ error: 'User not found' }, { status: 404 });
  }

  return json(profile);
}
