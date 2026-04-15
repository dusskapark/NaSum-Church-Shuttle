import { NextRequest, NextResponse } from 'next/server';
import type { SessionActor } from './session';
import { verifySession } from './session';

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function error(status: number, message: string) {
  return json({ error: message }, { status });
}

export async function getActor(
  request: NextRequest,
): Promise<SessionActor | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    return await verifySession(authHeader.slice(7));
  } catch {
    return null;
  }
}

export async function requireActor(
  request: NextRequest,
  minimumRole: 'rider' | 'driver' | 'admin' = 'rider',
): Promise<SessionActor | NextResponse> {
  const actor = await getActor(request);
  if (!actor) return error(401, 'Authorization header required');

  if (minimumRole === 'driver' && actor.role === 'rider') {
    return error(403, 'Driver role required');
  }

  if (minimumRole === 'admin' && actor.role !== 'admin') {
    return error(403, 'Admin role required');
  }

  return actor;
}
