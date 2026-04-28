import { NextRequest } from 'next/server';
import {
  createAuthSession,
  getAuthErrorResponse,
  logAuthEvent,
} from '@/server/auth';
import { json } from '@/server/http';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    accessToken?: string;
    access_token?: string;
    idToken?: string;
    id_token?: string;
  };

  try {
    const session = await createAuthSession(
      {
        provider: 'line',
        credential: {
          accessToken: body.accessToken,
          access_token: body.access_token,
          idToken: body.idToken,
          id_token: body.id_token,
        },
      },
      {
        ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
        userAgent: request.headers.get('user-agent'),
      },
    );

    return json({
      userId: session.userId,
      providerUid: session.providerUid,
      displayName: session.displayName,
      pictureUrl: session.pictureUrl,
      statusMessage: session.statusMessage,
      email: session.email,
      phone: null,
      role: session.role,
      sessionToken: session.sessionToken,
      idToken: session.sessionToken,
    });
  } catch (caught) {
    logAuthEvent('failure', 'line');
    const response = getAuthErrorResponse(caught);
    return json(response.body, { status: response.status });
  }
}
