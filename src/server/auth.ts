import { randomUUID, createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { env } from './env';
import { query, queryOne, withTransaction } from './db';
import { signSession, type SessionActor } from './session';
import {
  fetchLineProfile,
  verifyLineAccessToken,
  verifyLineIdToken,
} from './line-auth';

export type AuthProvider = 'line' | 'apple' | 'google' | 'email_password';

type CoreRole = SessionActor['role'];

interface VerifiedIdentity {
  provider: AuthProvider;
  providerUid: string;
  providerEmail?: string | null;
  emailVerified?: boolean;
  displayName?: string | null;
  pictureUrl?: string | null;
  statusMessage?: string | null;
  allowEmailAutoLink?: boolean;
}

interface AuthContext {
  ip?: string | null;
  userAgent?: string | null;
}

export interface AuthUser {
  id: string;
  displayName: string | null;
  pictureUrl: string | null;
  email: string | null;
  role: CoreRole;
}

interface AuthIdentityResponse {
  id: string;
  provider: string;
  providerUid: string;
  providerEmail: string | null;
  emailVerified: boolean;
}

export interface AuthSessionResponse {
  sessionToken: string;
  user: AuthUser;
  identities: AuthIdentityResponse[];
  providerUid: string;
  displayName: string | null;
  pictureUrl: string | null;
  statusMessage: string | null;
  email: string | null;
  role: CoreRole;
  userId: string;
  identityId: string;
}

export type AuthSessionRequest =
  | {
      provider: 'line';
      credential?: {
        accessToken?: string;
        access_token?: string;
        idToken?: string;
        id_token?: string;
      };
      accessToken?: string;
      access_token?: string;
      idToken?: string;
      id_token?: string;
    }
  | {
      provider: 'apple';
      credential: {
        identityToken?: string;
        identity_token?: string;
        authorizationCode?: string;
        authorization_code?: string;
        nonce?: string;
      };
    }
  | {
      provider: 'google';
      credential: {
        idToken?: string;
        id_token?: string;
      };
    }
  | {
      provider: 'email_password';
      credential: {
        email?: string;
        password?: string;
      };
    };

interface AppleClaims {
  sub?: string;
  email?: string;
  email_verified?: string | boolean;
  nonce?: string;
  name?: string;
}

interface GoogleClaims {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

const appleJWKS = createRemoteJWKSet(
  new URL('https://appleid.apple.com/auth/keys'),
);
const googleJWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/oauth2/v3/certs'),
);
const emailPasswordRateLimit = new Map<
  string,
  { count: number; resetAt: number }
>();
const EMAIL_PASSWORD_WINDOW_MS = 5 * 60_000;
const EMAIL_PASSWORD_MAX_ATTEMPTS = 10;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function getEmailHash(email: string) {
  return createHash('sha256').update(normalizeEmail(email)).digest('hex');
}

function assertEmailPasswordRateLimit(email: string, context: AuthContext) {
  const now = Date.now();
  const key = `${context.ip ?? 'unknown'}:${getEmailHash(email)}`;
  const current = emailPasswordRateLimit.get(key);

  if (!current || current.resetAt <= now) {
    emailPasswordRateLimit.set(key, {
      count: 1,
      resetAt: now + EMAIL_PASSWORD_WINDOW_MS,
    });
    return;
  }

  if (current.count >= EMAIL_PASSWORD_MAX_ATTEMPTS) {
    throw Object.assign(new Error('Too many login attempts'), {
      status: 429,
      code: 'EMAIL_PASSWORD_RATE_LIMITED',
    });
  }

  current.count += 1;
}

function titleizeEmailPrefix(email: string): string {
  return email
    .split('@')[0]
    .split(/[._-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function parseAuthAudienceList(
  configuredList: string | undefined,
  fallbacks: Array<string | undefined>,
) {
  const values = [
    ...(configuredList ?? '').split(','),
    ...fallbacks,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  return Array.from(new Set(values));
}

function getProviderConfig(provider: 'apple' | 'google') {
  if (provider === 'apple') {
    const audience = env.APPLE_CLIENT_ID ?? env.APPLE_BUNDLE_ID;
    if (!audience) {
      throw Object.assign(new Error('APPLE_CLIENT_ID or APPLE_BUNDLE_ID is not configured'), {
        status: 500,
        code: 'AUTH_PROVIDER_NOT_CONFIGURED',
      });
    }
    return { audience };
  }

  const audience = parseAuthAudienceList(env.GOOGLE_AUTH_CLIENT_IDS, [
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_SERVER_CLIENT_ID,
    env.GOOGLE_IOS_CLIENT_ID,
    env.GOOGLE_ANDROID_CLIENT_ID,
  ]);

  if (audience.length === 0) {
    throw Object.assign(new Error('Google auth client IDs are not configured'), {
      status: 500,
      code: 'AUTH_PROVIDER_NOT_CONFIGURED',
    });
  }
  return { audience };
}

async function verifyAppleIdentityToken(
  identityToken: string,
  nonce?: string,
): Promise<VerifiedIdentity> {
  if (!identityToken) {
    throw Object.assign(new Error('Apple identityToken is required'), {
      status: 400,
      code: 'AUTH_CREDENTIAL_REQUIRED',
    });
  }
  const { audience } = getProviderConfig('apple');
  const verified = await jwtVerify(identityToken, appleJWKS, {
    issuer: 'https://appleid.apple.com',
    audience,
  });
  const claims = verified.payload as AppleClaims;

  if (!claims.sub) {
    throw Object.assign(new Error('Apple identity token returned no subject'), {
      status: 401,
      code: 'APPLE_TOKEN_INVALID',
    });
  }
  if (nonce && claims.nonce !== nonce) {
    throw Object.assign(new Error('Apple identity token nonce mismatch'), {
      status: 401,
      code: 'APPLE_NONCE_MISMATCH',
    });
  }

  const emailVerified =
    claims.email_verified === true || claims.email_verified === 'true';
  const email = claims.email ? normalizeEmail(claims.email) : null;

  return {
    provider: 'apple',
    providerUid: claims.sub,
    providerEmail: email,
    emailVerified,
    displayName: claims.name ?? (email ? titleizeEmailPrefix(email) : 'Apple User'),
    pictureUrl: null,
    allowEmailAutoLink: emailVerified,
  };
}

async function verifyGoogleIdToken(idToken: string): Promise<VerifiedIdentity> {
  if (!idToken) {
    throw Object.assign(new Error('Google idToken is required'), {
      status: 400,
      code: 'AUTH_CREDENTIAL_REQUIRED',
    });
  }
  const { audience } = getProviderConfig('google');
  const verified = await jwtVerify(idToken, googleJWKS, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience,
  });
  const claims = verified.payload as GoogleClaims;

  if (!claims.sub) {
    throw Object.assign(new Error('Google ID token returned no subject'), {
      status: 401,
      code: 'GOOGLE_TOKEN_INVALID',
    });
  }

  const email = claims.email ? normalizeEmail(claims.email) : null;
  return {
    provider: 'google',
    providerUid: claims.sub,
    providerEmail: email,
    emailVerified: claims.email_verified === true,
    displayName: claims.name ?? (email ? titleizeEmailPrefix(email) : 'Google User'),
    pictureUrl: claims.picture ?? null,
    allowEmailAutoLink: claims.email_verified === true,
  };
}

async function verifyLineCredential(
  credential: Extract<AuthSessionRequest, { provider: 'line' }>,
): Promise<VerifiedIdentity> {
  const accessToken =
    credential.credential?.accessToken ??
    credential.credential?.access_token ??
    credential.accessToken ??
    credential.access_token;
  const idToken =
    credential.credential?.idToken ??
    credential.credential?.id_token ??
    credential.idToken ??
    credential.id_token;

  if (accessToken && idToken) {
    throw Object.assign(
      new Error('Provide exactly one LINE token: accessToken or idToken'),
      { status: 400, code: 'AUTH_AMBIGUOUS_CREDENTIAL' },
    );
  }
  if (!accessToken && !idToken) {
    throw Object.assign(new Error('accessToken or idToken is required'), {
      status: 400,
      code: 'AUTH_CREDENTIAL_REQUIRED',
    });
  }

  if (accessToken) {
    await verifyLineAccessToken(accessToken);
    const profile = await fetchLineProfile(accessToken);
    return {
      provider: 'line',
      providerUid: profile.sub,
      providerEmail: profile.email ? normalizeEmail(profile.email) : null,
      emailVerified: Boolean(profile.email),
      displayName: profile.displayName ?? 'LINE User',
      pictureUrl: profile.pictureUrl ?? null,
      statusMessage: profile.statusMessage ?? null,
      allowEmailAutoLink: false,
    };
  }

  const token = await verifyLineIdToken(idToken!);
  return {
    provider: 'line',
    providerUid: token.sub!,
    providerEmail: token.email ? normalizeEmail(token.email) : null,
    emailVerified: Boolean(token.email),
    displayName:
      token.name ??
      (token.email ? titleizeEmailPrefix(token.email) : 'LINE User'),
    pictureUrl: token.picture ?? null,
    statusMessage: null,
    allowEmailAutoLink: false,
  };
}

async function provisionAppleReviewAdmin() {
  if (!env.APPLE_REVIEW_ADMIN_EMAIL || !env.APPLE_REVIEW_ADMIN_PASSWORD) {
    throw Object.assign(new Error('Apple Review admin credentials are not configured'), {
      status: 401,
      code: 'EMAIL_PASSWORD_DISABLED',
    });
  }

  const email = normalizeEmail(env.APPLE_REVIEW_ADMIN_EMAIL);
  const name = env.APPLE_REVIEW_ADMIN_NAME ?? 'Apple Review Admin';
  const passwordHash = await bcrypt.hash(env.APPLE_REVIEW_ADMIN_PASSWORD, 12);

  await withTransaction(async (client) => {
    const existing = await client
      .query<{ user_id: string }>(
        `SELECT user_id
         FROM user_identities
         WHERE provider = 'email_password' AND provider_uid = $1`,
        [email],
      )
      .then((res) => res.rows[0] ?? null);

    const userId = existing?.user_id ?? randomUUID();
    await client.query(
      `INSERT INTO users (id, display_name, email, role)
       VALUES ($1, $2, $3, 'admin')
       ON CONFLICT (id)
       DO UPDATE SET
         display_name = EXCLUDED.display_name,
         email = EXCLUDED.email,
         role = 'admin'`,
      [userId, name, email],
    );
    await client.query(
      `INSERT INTO user_identities
         (id, user_id, provider, provider_uid, provider_email, email_verified, last_login_at, updated_at)
       VALUES ($1, $2, 'email_password', $3, $3, true, NOW(), NOW())
       ON CONFLICT (provider, provider_uid)
       DO UPDATE SET
         user_id = EXCLUDED.user_id,
         provider_email = EXCLUDED.provider_email,
         email_verified = true,
         updated_at = NOW()`,
      [randomUUID(), userId, email],
    );
    await client.query(
      `INSERT INTO password_credentials
         (user_id, email, password_hash, is_active, failed_attempts, locked_until, updated_at)
       VALUES ($1, $2, $3, true, 0, NULL, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET
         email = EXCLUDED.email,
         password_hash = EXCLUDED.password_hash,
         is_active = true,
         updated_at = NOW()`,
      [userId, email, passwordHash],
    );
  });

  return email;
}

async function verifyEmailPassword(
  emailInput: string | undefined,
  password: string | undefined,
  context: AuthContext,
): Promise<VerifiedIdentity> {
  if (!emailInput || !password) {
    throw Object.assign(new Error('Invalid email or password'), {
      status: 401,
      code: 'EMAIL_PASSWORD_INVALID',
    });
  }

  const email = normalizeEmail(emailInput);
  assertEmailPasswordRateLimit(email, context);
  const reviewEmail = await provisionAppleReviewAdmin();
  if (email !== reviewEmail) {
    throw Object.assign(new Error('Invalid email or password'), {
      status: 401,
      code: 'EMAIL_PASSWORD_INVALID',
    });
  }

  const credential = await queryOne<{
    user_id: string;
    password_hash: string;
    is_active: boolean;
    failed_attempts: number;
    locked_until: Date | null;
  }>(
    `SELECT user_id, password_hash, is_active, failed_attempts, locked_until
     FROM password_credentials
     WHERE email = $1`,
    [email],
  );

  if (!credential?.is_active) {
    throw Object.assign(new Error('Invalid email or password'), {
      status: 401,
      code: 'EMAIL_PASSWORD_INVALID',
    });
  }
  if (credential.locked_until && credential.locked_until.getTime() > Date.now()) {
    throw Object.assign(new Error('Invalid email or password'), {
      status: 401,
      code: 'EMAIL_PASSWORD_LOCKED',
    });
  }

  const ok = await bcrypt.compare(password, credential.password_hash);
  if (!ok) {
    const failedAttempts = credential.failed_attempts + 1;
    const lockedUntil = failedAttempts >= 5 ? new Date(Date.now() + 5 * 60_000) : null;
    await query(
      `UPDATE password_credentials
       SET failed_attempts = $1, locked_until = $2, updated_at = NOW()
       WHERE email = $3`,
      [failedAttempts, lockedUntil, email],
    );
    throw Object.assign(new Error('Invalid email or password'), {
      status: 401,
      code: 'EMAIL_PASSWORD_INVALID',
    });
  }

  await query(
    `UPDATE password_credentials
     SET failed_attempts = 0,
         locked_until = NULL,
         last_login_at = NOW(),
         updated_at = NOW()
     WHERE email = $1`,
    [email],
  );

  return {
    provider: 'email_password',
    providerUid: email,
    providerEmail: email,
    emailVerified: true,
    displayName: env.APPLE_REVIEW_ADMIN_NAME ?? 'Apple Review Admin',
    pictureUrl: null,
    allowEmailAutoLink: false,
  };
}

async function verifyCredential(
  body: AuthSessionRequest,
  context: AuthContext,
): Promise<VerifiedIdentity> {
  switch (body.provider) {
    case 'line':
      return verifyLineCredential(body);
    case 'apple':
      return verifyAppleIdentityToken(
        body.credential.identityToken ?? body.credential.identity_token ?? '',
        body.credential.nonce,
      );
    case 'google':
      return verifyGoogleIdToken(
        body.credential.idToken ?? body.credential.id_token ?? '',
      );
    case 'email_password':
      return verifyEmailPassword(
        body.credential.email,
        body.credential.password,
        context,
      );
    default:
      throw Object.assign(new Error('Unsupported auth provider'), {
        status: 400,
        code: 'AUTH_PROVIDER_UNSUPPORTED',
      });
  }
}

async function listIdentities(userId: string) {
  return query<AuthIdentityResponse>(
    `SELECT
       id,
       provider,
       provider_uid AS "providerUid",
       provider_email AS "providerEmail",
       email_verified AS "emailVerified"
     FROM user_identities
     WHERE user_id = $1
     ORDER BY created_at ASC`,
    [userId],
  );
}

async function upsertVerifiedIdentity(verified: VerifiedIdentity) {
  return withTransaction(async (client) => {
    const existingIdentity = await client
      .query<{
        identity_id: string;
        user_id: string;
        role: CoreRole;
        display_name: string | null;
        picture_url: string | null;
        email: string | null;
      }>(
        `SELECT
           ui.id AS identity_id,
           ui.user_id,
           u.role,
           u.display_name,
           u.picture_url,
           u.email
         FROM user_identities ui
         JOIN users u ON u.id = ui.user_id
         WHERE ui.provider = $1 AND ui.provider_uid = $2`,
        [verified.provider, verified.providerUid],
      )
      .then((res) => res.rows[0] ?? null);

    let userId = existingIdentity?.user_id;
    let identityId = existingIdentity?.identity_id;

    if (!userId && verified.allowEmailAutoLink && verified.providerEmail) {
      const matches = await client
        .query<{ id: string }>(
          `SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 2`,
          [verified.providerEmail],
        )
        .then((res) => res.rows);
      if (matches.length > 1) {
        throw Object.assign(new Error('Multiple accounts use this email'), {
          status: 409,
          code: 'AUTH_EMAIL_LINK_CONFLICT',
        });
      }
      userId = matches[0]?.id;
    }

    if (!userId) {
      userId = randomUUID();
      await client.query(
        `INSERT INTO users (id, display_name, picture_url, email, role)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          userId,
          verified.displayName ?? titleizeEmailPrefix(verified.providerUid),
          verified.pictureUrl ?? null,
          verified.emailVerified ? verified.providerEmail ?? null : null,
          verified.provider === 'email_password' ? 'admin' : 'rider',
        ],
      );
    } else {
      await client.query(
        `UPDATE users
         SET display_name = COALESCE($1, display_name),
             picture_url = COALESCE($2, picture_url),
             email = COALESCE(email, $3)
         WHERE id = $4`,
        [
          verified.displayName ?? null,
          verified.pictureUrl ?? null,
          verified.emailVerified ? verified.providerEmail ?? null : null,
          userId,
        ],
      );
    }

    if (!identityId) {
      identityId = randomUUID();
      await client.query(
        `INSERT INTO user_identities
           (id, user_id, provider, provider_uid, provider_email, email_verified, last_login_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        [
          identityId,
          userId,
          verified.provider,
          verified.providerUid,
          verified.providerEmail ?? null,
          verified.emailVerified === true,
        ],
      );
    } else {
      await client.query(
        `UPDATE user_identities
         SET provider_email = COALESCE($1, provider_email),
             email_verified = $2,
             last_login_at = NOW(),
             updated_at = NOW()
         WHERE id = $3`,
        [verified.providerEmail ?? null, verified.emailVerified === true, identityId],
      );
    }

    const user = await client
      .query<AuthUser>(
        `SELECT
           id,
           display_name AS "displayName",
           picture_url AS "pictureUrl",
           email,
           role
         FROM users
         WHERE id = $1`,
        [userId],
      )
      .then((res) => res.rows[0]);

    if (!user) {
      throw Object.assign(new Error('User not found after auth upsert'), {
        status: 500,
        code: 'AUTH_USER_UPSERT_FAILED',
      });
    }

    return { user, identityId };
  });
}

export async function createAuthSession(
  body: AuthSessionRequest,
  context: AuthContext = {},
): Promise<AuthSessionResponse> {
  const verified = await verifyCredential(body, context);
  const { user, identityId } = await upsertVerifiedIdentity(verified);
  const identities = await listIdentities(user.id);
  const sessionToken = await signSession({
    userId: user.id,
    role: user.role,
    authProvider: verified.provider,
    identityId,
    providerUid: verified.providerUid,
  });

  const response: AuthSessionResponse = {
    sessionToken,
    user,
    identities,
    userId: user.id,
    providerUid: verified.providerUid,
    displayName: user.displayName,
    pictureUrl: user.pictureUrl,
    statusMessage: verified.statusMessage ?? null,
    email: user.email,
    role: user.role,
    identityId,
  };

  logAuthEvent('success', verified.provider, user.id, verified.providerEmail);
  return response;
}

export function logAuthEvent(
  outcome: 'success' | 'failure',
  provider: string,
  userId?: string | null,
  email?: string | null,
) {
  console.info('[auth]', {
    outcome,
    provider,
    userId: userId ?? null,
    emailHash: email ? getEmailHash(email) : null,
  });
}

export function getAuthErrorResponse(caught: unknown) {
  const status = (caught as { status?: number }).status;
  const code = (caught as { code?: string }).code;
  const message = caught instanceof Error ? caught.message : 'Authentication failed';

  if (status === 400 || status === 409 || status === 429) {
    return { status, body: { error: message, code } };
  }
  if (status === 500 && code === 'AUTH_PROVIDER_NOT_CONFIGURED') {
    return { status, body: { error: message, code } };
  }
  if (
    status === 401 ||
    code?.startsWith('ERR_JWS') ||
    code?.startsWith('ERR_JWT') ||
    /token|password|credential|login|jws|jwt/i.test(message)
  ) {
    return {
      status: 401,
      body: {
        error: /email|password/i.test(message)
          ? 'Invalid email or password'
          : 'Authentication rejected. Re-login required.',
        code,
      },
    };
  }

  return {
    status: 502,
    body: {
      error: 'Authentication provider verification failed',
      details: message,
      code,
    },
  };
}
