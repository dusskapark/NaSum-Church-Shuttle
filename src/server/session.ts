import { SignJWT, jwtVerify } from 'jose';
import { env } from './env';

export interface SessionActor {
  userId: string;
  providerUid: string;
  role: 'rider' | 'driver' | 'admin';
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
    provider_uid: actor.providerUid,
    role: actor.role,
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
  const providerUid = verified.payload.provider_uid;

  if (
    typeof verified.payload.sub !== 'string' ||
    typeof providerUid !== 'string' ||
    (role !== 'rider' && role !== 'driver' && role !== 'admin')
  ) {
    throw new Error('Invalid session token');
  }

  return {
    userId: verified.payload.sub,
    providerUid,
    role,
  };
}
