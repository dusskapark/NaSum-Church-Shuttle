import { randomUUID } from 'node:crypto';
import { env } from './env';
import { query, queryOne } from './db';
import type { SessionActor } from './session';

interface VerifyAccessTokenResponse {
  scope?: string;
  client_id?: string;
  expires_in?: number;
}

interface VerifyIdTokenResponse {
  sub?: string;
  name?: string;
  picture?: string;
  email?: string;
}

interface LineProfileResponse {
  userId?: string;
  displayName?: string;
  pictureUrl?: string;
  statusMessage?: string;
}

export interface VerifiedLineIdentity {
  sub: string;
  displayName?: string | null;
  pictureUrl?: string | null;
  statusMessage?: string | null;
  email?: string | null;
}

function titleizeEmailPrefix(email: string): string {
  return email
    .split('@')[0]
    .split(/[._-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getLineClientId(): string {
  const clientId =
    env.LINE_LOGIN_CHANNEL_ID ?? process.env.NEXT_PUBLIC_LIFF_ID ?? '';
  if (!clientId) {
    throw new Error('LINE_LOGIN_CHANNEL_ID is not configured');
  }

  return clientId;
}

function parseScopes(scope: string | undefined): string[] {
  return (scope ?? '')
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function verifyLineAccessToken(
  accessToken: string,
): Promise<VerifyAccessTokenResponse> {
  const clientId = getLineClientId();
  const url = new URL('https://api.line.me/oauth2/v2.1/verify');
  url.searchParams.set('access_token', accessToken);

  const response = await fetch(url, {
    method: 'GET',
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    const err = new Error(
      `LINE access token verification failed: ${response.status} ${text}`,
    ) as Error & { code?: string; status?: number };
    err.status = response.status;
    if (/invalid|expired/i.test(text)) {
      err.code = 'LINE_ACCESS_TOKEN_INVALID';
    }
    throw err;
  }

  const data = (await response.json()) as VerifyAccessTokenResponse;
  if (data.client_id !== clientId) {
    const err = new Error('LINE access token client_id mismatch') as Error & {
      code?: string;
      status?: number;
    };
    err.code = 'LINE_ACCESS_TOKEN_CLIENT_ID_MISMATCH';
    err.status = 401;
    throw err;
  }

  if (typeof data.expires_in !== 'number' || data.expires_in <= 0) {
    const err = new Error('LINE access token expired') as Error & {
      code?: string;
      status?: number;
    };
    err.code = 'LINE_ACCESS_TOKEN_EXPIRED';
    err.status = 401;
    throw err;
  }

  const scopes = parseScopes(data.scope);
  if (!scopes.includes('profile')) {
    const err = new Error('LINE access token missing profile scope') as Error & {
      code?: string;
      status?: number;
    };
    err.code = 'LINE_ACCESS_TOKEN_SCOPE_MISSING';
    err.status = 401;
    throw err;
  }

  return data;
}

export async function fetchLineProfile(
  accessToken: string,
): Promise<VerifiedLineIdentity> {
  const response = await fetch('https://api.line.me/v2/profile', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    const err = new Error(
      `LINE profile request failed: ${response.status} ${text}`,
    ) as Error & { code?: string; status?: number };
    err.code = 'LINE_PROFILE_FETCH_FAILED';
    err.status = response.status;
    throw err;
  }

  const data = (await response.json()) as LineProfileResponse;
  if (!data.userId) {
    throw new Error('LINE profile response returned no userId');
  }

  return {
    sub: data.userId,
    displayName: data.displayName ?? null,
    pictureUrl: data.pictureUrl ?? null,
    statusMessage: data.statusMessage ?? null,
    email: null,
  };
}

export async function verifyLineIdToken(
  idToken: string,
): Promise<VerifyIdTokenResponse> {
  const clientId = getLineClientId();

  const body = new URLSearchParams({
    id_token: idToken,
    client_id: clientId,
  });

  const response = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    const err = new Error(
      `LINE token verification failed: ${response.status} ${text}`,
    ) as Error & { code?: string; status?: number };
    err.status = response.status;
    if (/IdToken expired/i.test(text)) {
      err.code = 'LINE_ID_TOKEN_EXPIRED';
    }
    throw err;
  }

  const data = (await response.json()) as VerifyIdTokenResponse;
  if (!data.sub) {
    throw new Error('LINE token verification returned no sub');
  }

  return data;
}

export async function upsertLineIdentity({
  verified,
}: {
  verified: VerifiedLineIdentity;
}): Promise<
  SessionActor & {
    displayName: string;
    email: string | null;
    pictureUrl: string | null;
    statusMessage: string | null;
  }
> {
  const provider = 'line';
  const providerUid = verified.sub;
  const displayName =
    verified.displayName ??
    (verified.email ? titleizeEmailPrefix(verified.email) : 'LINE User');
  const pictureUrl = verified.pictureUrl ?? null;
  const statusMessage = verified.statusMessage ?? null;
  const email = verified.email ?? null;

  const identity = await queryOne<{ user_id: string; role: SessionActor['role'] }>(
    `SELECT ui.user_id, u.role
     FROM user_identities ui
     JOIN users u ON u.id = ui.user_id
     WHERE ui.provider = $1 AND ui.provider_uid = $2`,
    [provider, providerUid],
  );

  let userId = identity?.user_id ?? randomUUID();
  let role: SessionActor['role'] = identity?.role ?? 'rider';

  if (identity) {
    await query(
      `UPDATE users
       SET display_name = COALESCE($1, display_name),
           picture_url = COALESCE($2, picture_url),
           email = COALESCE($3, email)
       WHERE id = $4`,
      [displayName, pictureUrl, email, userId],
    );
  } else {
    await query(
      `INSERT INTO users (id, display_name, picture_url, email, role)
       VALUES ($1, $2, $3, $4, 'rider')`,
      [userId, displayName, pictureUrl, email],
    );
    await query(
      `INSERT INTO user_identities (id, user_id, provider, provider_uid)
       VALUES ($1, $2, $3, $4)`,
      [randomUUID(), userId, provider, providerUid],
    );
  }

  return {
    userId,
    providerUid,
    role,
    displayName,
    email,
    pictureUrl,
    statusMessage,
  };
}
