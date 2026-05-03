import { queryOne } from './db';

export interface ActorProfile {
  userId: string;
  providerUid: string | null;
  displayName: string | null;
  pictureUrl: string | null;
  email: string | null;
  role: 'rider' | 'driver' | 'admin';
  preferredLanguage: 'ko' | 'en';
  pushNotificationsEnabled: boolean;
  createdAt: string;
}

export async function fetchActorProfile(
  userId: string,
  identityId?: string | null,
): Promise<ActorProfile | null> {
  const row = await queryOne<{
    user_id: string;
    provider_uid: string | null;
    display_name: string | null;
    picture_url: string | null;
    email: string | null;
    role: 'rider' | 'driver' | 'admin';
    preferred_language: 'ko' | 'en' | null;
    push_notifications_enabled: boolean;
    created_at: Date;
  }>(
    `SELECT
       u.id AS user_id,
       ui.provider_uid,
       u.display_name,
       u.picture_url,
       u.email,
       u.role,
       COALESCE(u.preferred_language, 'ko')::text AS preferred_language,
       u.push_notifications_enabled,
       u.created_at
     FROM users u
     LEFT JOIN LATERAL (
       SELECT provider_uid
       FROM user_identities
       WHERE user_id = u.id
       ORDER BY
         CASE WHEN id = $2 THEN 0 ELSE 1 END,
         last_login_at DESC NULLS LAST,
         created_at DESC
       LIMIT 1
     ) ui ON true
     WHERE u.id = $1
     LIMIT 1`,
    [userId, identityId ?? null],
  );

  if (!row) return null;

  return {
    userId: row.user_id,
    providerUid: row.provider_uid,
    displayName: row.display_name,
    pictureUrl: row.picture_url,
    email: row.email,
    role: row.role,
    preferredLanguage: row.preferred_language === 'en' ? 'en' : 'ko',
    pushNotificationsEnabled: row.push_notifications_enabled,
    createdAt: row.created_at.toISOString(),
  };
}
