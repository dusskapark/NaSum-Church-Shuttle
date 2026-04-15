import { randomUUID } from 'node:crypto';
import { env } from './env';
import { query, queryOne } from './db';
import type { SessionActor } from './session';

interface VerifyIdTokenResponse {
  sub?: string;
  name?: string;
  picture?: string;
  email?: string;
}

function titleizeEmailPrefix(email: string): string {
  return email
    .split('@')[0]
    .split(/[._-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export async function verifyLineIdToken(
  idToken: string,
): Promise<VerifyIdTokenResponse> {
  const clientId =
    env.LINE_LOGIN_CHANNEL_ID ?? process.env.NEXT_PUBLIC_LIFF_ID ?? '';
  if (!clientId) {
    throw new Error('LINE_LOGIN_CHANNEL_ID is not configured');
  }

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
    throw new Error(`LINE token verification failed: ${response.status} ${text}`);
  }

  const data = (await response.json()) as VerifyIdTokenResponse;
  if (!data.sub) {
    throw new Error('LINE token verification returned no sub');
  }

  return data;
}

export async function upsertLineIdentity({
  profile,
  verified,
}: {
  profile?: {
    displayName?: string | null;
    pictureUrl?: string | null;
  } | null;
  verified: VerifyIdTokenResponse;
}): Promise<SessionActor & { displayName: string; email: string | null; pictureUrl: string | null }> {
  const provider = 'line';
  const providerUid = verified.sub!;
  const displayName =
    profile?.displayName ??
    verified.name ??
    (verified.email ? titleizeEmailPrefix(verified.email) : 'LINE User');
  const pictureUrl = profile?.pictureUrl ?? verified.picture ?? null;
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

  return { userId, providerUid, role, displayName, email, pictureUrl };
}
