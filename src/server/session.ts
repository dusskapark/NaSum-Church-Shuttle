import { SignJWT, jwtVerify } from 'jose';
import { env } from './env';

export interface SessionActor {
  userId: string;
  role: 'rider' | 'driver' | 'admin';
  authProvider?: string | null;
  identityId?: string | null;
  providerUid?: string | null;
}

const encoder = new TextEncoder();

function getSecret() {
  const secret = env.SESSION_SECRET ?? env.LINE_LOGIN_CHANNEL_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET or LINE_LOGIN_CHANNEL_SECRET is required');
  }
  return encoder.encode(secret);
}

export async function signSession(actor: SessionActor): Promise<string> {
  return new SignJWT({
    role: actor.role,
    auth_provider: actor.authProvider ?? undefined,
    identity_id: actor.identityId ?? undefined,
    provider_uid: actor.providerUid ?? undefined,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(actor.userId)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret());
}

export async function verifySession(token: string): Promise<SessionActor> {
  const verified = await jwtVerify(token, getSecret(), {
    algorithms: ['HS256'],
  });

  const role = verified.payload.role;
  const authProvider = verified.payload.auth_provider;
  const identityId = verified.payload.identity_id;
  const providerUid = verified.payload.provider_uid;

  if (
    typeof verified.payload.sub !== 'string' ||
    (role !== 'rider' && role !== 'driver' && role !== 'admin')
  ) {
    throw new Error('Invalid session token');
  }

  return {
    userId: verified.payload.sub,
    role,
    authProvider: typeof authProvider === 'string' ? authProvider : null,
    identityId: typeof identityId === 'string' ? identityId : null,
    providerUid: typeof providerUid === 'string' ? providerUid : null,
  };
}
