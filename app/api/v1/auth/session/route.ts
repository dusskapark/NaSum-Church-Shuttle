import { NextRequest } from 'next/server';
import {
  createAuthSession,
  getAuthErrorResponse,
  logAuthEvent,
  type AuthSessionRequest,
} from '@/server/auth';
import { json } from '@/server/http';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let body: AuthSessionRequest;
  try {
    body = (await request.json()) as AuthSessionRequest;
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const session = await createAuthSession(body, {
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: request.headers.get('user-agent'),
    });
    return json(session);
  } catch (caught) {
    logAuthEvent('failure', (body as { provider?: string }).provider ?? 'unknown');
    const response = getAuthErrorResponse(caught);
    return json(response.body, { status: response.status });
  }
}
