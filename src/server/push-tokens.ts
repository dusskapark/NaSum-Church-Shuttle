import { randomUUID } from 'node:crypto';
import { query } from './db';
import { env } from './env';

export type ApnsEnvironment = 'sandbox' | 'production';
export type PushPlatform = 'ios' | 'android';

export interface DevicePushTokenRecord {
  id: string;
  user_id: string;
  platform: PushPlatform;
  token: string;
  bundle_id: string | null;
  apns_environment: ApnsEnvironment | null;
  package_name: string | null;
  is_active: boolean;
  last_seen_at: Date;
  created_at: Date;
  updated_at: Date;
}

export function resolveApnsEnvironment(
  input?: string | null,
): ApnsEnvironment {
  if (input === 'production') return 'production';
  if (input === 'sandbox') return 'sandbox';
  return env.APNS_ENVIRONMENT ?? 'sandbox';
}

export async function upsertDevicePushToken(params: {
  userId: string;
  token: string;
  platform?: PushPlatform | null;
  bundleId?: string | null;
  apnsEnvironment?: string | null;
  packageName?: string | null;
}): Promise<DevicePushTokenRecord> {
  const normalizedToken = params.token.trim();
  const platform = params.platform ?? 'ios';
  const bundleId = (params.bundleId ?? env.APNS_BUNDLE_ID ?? '').trim();
  const packageName = (
    params.packageName ??
    env.ANDROID_APP_PACKAGE_NAME ??
    ''
  ).trim();
  if (!normalizedToken) {
    throw new Error('token is required');
  }
  if (platform === 'ios' && !bundleId) {
    throw new Error('bundle_id is required');
  }
  if (platform === 'android' && !packageName) {
    throw new Error('package_name is required');
  }

  const rows = await query<DevicePushTokenRecord>(
    `INSERT INTO device_push_tokens
       (id, user_id, platform, token, bundle_id, apns_environment, package_name, is_active, last_seen_at, created_at, updated_at)
     VALUES
       ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW(), NOW())
     ON CONFLICT (token)
     DO UPDATE SET
       user_id = EXCLUDED.user_id,
       platform = EXCLUDED.platform,
       bundle_id = EXCLUDED.bundle_id,
       apns_environment = EXCLUDED.apns_environment,
       package_name = EXCLUDED.package_name,
       is_active = true,
       last_seen_at = NOW(),
       updated_at = NOW()
     RETURNING *`,
    [
      randomUUID(),
      params.userId,
      platform,
      normalizedToken,
      platform === 'ios' ? bundleId : null,
      platform === 'ios' ? resolveApnsEnvironment(params.apnsEnvironment) : null,
      platform === 'android' ? packageName : null,
    ],
  );

  return rows[0]!;
}

export async function deactivateDevicePushToken(params: {
  token: string;
  userId?: string | null;
}): Promise<boolean> {
  const normalizedToken = params.token.trim();
  if (!normalizedToken) return false;

  const predicates = ['token = $1'];
  const values: unknown[] = [normalizedToken];
  if (params.userId) {
    predicates.push(`user_id = $${values.length + 1}`);
    values.push(params.userId);
  }

  const rows = await query<{ token: string }>(
    `UPDATE device_push_tokens
     SET is_active = false,
         updated_at = NOW()
     WHERE ${predicates.join(' AND ')}
     RETURNING token`,
    values,
  );

  return rows.length > 0;
}

export async function fetchActiveDevicePushTokensForUsers(
  userIds: string[],
  platform?: PushPlatform,
): Promise<Map<string, DevicePushTokenRecord[]>> {
  if (userIds.length === 0) return new Map();

  const values: unknown[] = [...userIds];
  const placeholders = userIds.map((_, index) => `$${index + 1}`).join(', ');
  const platformPredicate = platform
    ? `AND platform = $${values.push(platform)}`
    : '';
  const rows = await query<DevicePushTokenRecord>(
    `SELECT *
     FROM device_push_tokens
     WHERE user_id IN (${placeholders})
       AND is_active = true
       ${platformPredicate}
     ORDER BY updated_at DESC`,
    values,
  );

  const byUserId = new Map<string, DevicePushTokenRecord[]>();
  rows.forEach((row) => {
    const existing = byUserId.get(row.user_id) ?? [];
    existing.push(row);
    byUserId.set(row.user_id, existing);
  });
  return byUserId;
}
