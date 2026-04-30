import { NextRequest, NextResponse } from 'next/server';
import type { SessionActor } from './session';
import { verifySession } from './session';

const DEV_BYPASS_TOKEN = 'dev-bypass-local-admin';

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
  const token = authHeader.slice(7);
  if (
    process.env.NODE_ENV !== 'production' &&
    token === DEV_BYPASS_TOKEN
  ) {
    return {
      userId: 'dev-user-001',
      role: 'admin',
      authProvider: 'dev',
      identityId: 'dev-user-001',
      providerUid: 'dev-user-001',
    };
  }
  try {
    return await verifySession(token);
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
