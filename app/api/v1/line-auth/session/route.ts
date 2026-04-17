import { NextRequest } from 'next/server';
import { json, error } from '@/server/http';
import { signSession } from '@/server/session';
import { upsertLineIdentity, verifyLineIdToken } from '@/server/line-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    idToken?: string;
    profile?: { displayName?: string | null; pictureUrl?: string | null } | null;
  };

  if (!body.idToken) return error(400, 'idToken is required');

  let actor: Awaited<ReturnType<typeof upsertLineIdentity>>;
  try {
    const verified = await verifyLineIdToken(body.idToken);
    actor = await upsertLineIdentity({
      verified,
      profile: body.profile ?? null,
    });
  } catch (caught) {
    const code = (caught as { code?: string }).code;
    const message = caught instanceof Error ? caught.message : 'LINE auth failed';

    if (code === 'LINE_ID_TOKEN_EXPIRED' || /IdToken expired/i.test(message)) {
      return json(
        {
          error: 'LINE ID token expired. Re-login required.',
          code: 'LINE_ID_TOKEN_EXPIRED',
        },
        { status: 401 },
      );
    }

    return json(
      {
        error: 'LINE token verification failed',
        details: message,
      },
      { status: 502 },
    );
  }

  const sessionToken = await signSession(actor);

  return json({
    userId: actor.userId,
    providerUid: actor.providerUid,
    displayName: actor.displayName,
    pictureUrl: actor.pictureUrl,
    statusMessage: actor.statusMessage,
    email: actor.email,
    phone: null,
    role: actor.role,
    idToken: sessionToken,
  });
}
