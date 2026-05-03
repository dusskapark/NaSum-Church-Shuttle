import { createHash, randomUUID } from 'node:crypto';
import { query } from './db';
import { sendLinePushShuttleCarousel } from './line-messaging';
import { logError } from '@/lib/logger';
import {
  fetchActiveDevicePushTokensForUsers,
  type DevicePushTokenRecord,
} from './push-tokens';
import {
  isApnsConfigured,
  sendApnsNotification,
  type ApnsDeliveryPayload,
} from './apns';
import {
  isFcmConfigured,
  sendFcmNotification,
  type FcmDeliveryPayload,
} from './fcm';

interface ArrivedStopRow {
  sequence: number;
  route_id: string;
  route_code: string;
}

interface NextStopRow {
  id: string;
  sequence: number;
}

interface TargetUserRow {
  user_id: string;
  route_stop_id: string;
  provider_uid: string | null;
  preferred_language: 'ko' | 'en';
  push_notifications_enabled: boolean;
}

interface NotificationTemplate {
  titleKo: string;
  bodyKo: string;
  titleEn: string;
  bodyEn: string;
}

export function buildApproachingTemplate(
  stopsAway: 1 | 2,
): NotificationTemplate {
  return {
    titleKo: '도착 알림',
    bodyKo: `${stopsAway} 정거장 전에 셔틀 버스가 도착했습니다.\n탑승을 준비하세요.`,
    titleEn: 'Arrival alert',
    bodyEn: `Shuttle is ${stopsAway} stop${stopsAway > 1 ? 's' : ''} away.\nPlease get ready to board.`,
  };
}

interface PendingNotification {
  id: string;
  userId: string;
  providerUid: string | null;
  preferredLanguage: 'ko' | 'en';
  externalPushEnabled: boolean;
  routeStopId: string;
  triggerStopId: string;
  routeCode: string;
  stopsAway: 1 | 2;
  titleKo: string;
  bodyKo: string;
  titleEn: string;
  bodyEn: string;
}

type DeliveryChannel = 'apns' | 'fcm' | 'line';
type DeliveryStatus = 'succeeded' | 'failed' | 'skipped';

export function buildNotificationDeepLinkPath(params: {
  routeCode: string;
  userRouteStopId: string;
}): string {
  const searchParams = new URLSearchParams({
    route: params.routeCode,
    stop: params.userRouteStopId,
  });
  return `/?${searchParams.toString()}`;
}

export function hashDeliveryTarget(params: {
  channel: DeliveryChannel;
  target: string;
}): string {
  return createHash('sha256')
    .update(`${params.channel}:${params.target}`)
    .digest('hex');
}

function buildInsertPlaceholders(rowCount: number, columnCount: number): string {
  return Array.from({ length: rowCount }, (_, rowIndex) => {
    const offset = rowIndex * columnCount;
    return `(${Array.from(
      { length: columnCount },
      (_, columnIndex) => `$${offset + columnIndex + 1}`,
    ).join(', ')})`;
  }).join(', ');
}

async function recordDeliveryAttempt(params: {
  notificationId: string;
  userId: string;
  channel: DeliveryChannel;
  targetHash?: string | null;
  status: DeliveryStatus;
  statusCode?: number | null;
  reason?: string | null;
  attemptedAt?: Date;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  await query(
    `INSERT INTO notification_delivery_attempts
       (id, notification_id, user_id, channel, target_hash, status,
        status_code, reason, attempted_at, completed_at, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10::jsonb)`,
    [
      randomUUID(),
      params.notificationId,
      params.userId,
      params.channel,
      params.targetHash ?? null,
      params.status,
      params.statusCode ?? null,
      params.reason ?? null,
      params.attemptedAt ?? new Date(),
      params.metadata ? JSON.stringify(params.metadata) : null,
    ],
  );
}

function localizedTitleAndBody(notification: PendingNotification): {
  title: string;
  body: string;
} {
  return notification.preferredLanguage === 'en'
    ? { title: notification.titleEn, body: notification.bodyEn }
    : { title: notification.titleKo, body: notification.bodyKo };
}

export function buildApnsDeliveryPayload(params: {
  notificationId: string;
  triggerStopId: string;
  userRouteStopId: string;
  routeCode: string;
  stopsAway: 1 | 2;
  title: string;
  body: string;
}): ApnsDeliveryPayload {
  return {
    title: params.title,
    body: params.body,
    routeCode: params.routeCode,
    stopsAway: params.stopsAway,
    notificationId: params.notificationId,
    triggerStopId: params.triggerStopId,
    userRouteStopId: params.userRouteStopId,
    deepLinkPath: buildNotificationDeepLinkPath({
      routeCode: params.routeCode,
      userRouteStopId: params.userRouteStopId,
    }),
  };
}

export function buildFcmDeliveryPayload(params: {
  notificationId: string;
  triggerStopId: string;
  userRouteStopId: string;
  routeCode: string;
  stopsAway: 1 | 2;
  title: string;
  body: string;
}): FcmDeliveryPayload {
  return {
    title: params.title,
    body: params.body,
    routeCode: params.routeCode,
    stopsAway: params.stopsAway,
    notificationId: params.notificationId,
    triggerStopId: params.triggerStopId,
    userRouteStopId: params.userRouteStopId,
    deepLinkPath: buildNotificationDeepLinkPath({
      routeCode: params.routeCode,
      userRouteStopId: params.userRouteStopId,
    }),
  };
}

async function recordExternalPushDisabled(
  notification: PendingNotification,
): Promise<void> {
  const metadata = {
    routeCode: notification.routeCode,
    userRouteStopId: notification.routeStopId,
  };
  await Promise.all([
    recordDeliveryAttempt({
      notificationId: notification.id,
      userId: notification.userId,
      channel: 'apns',
      status: 'skipped',
      reason: 'Push notifications disabled',
      metadata,
    }),
    recordDeliveryAttempt({
      notificationId: notification.id,
      userId: notification.userId,
      channel: 'line',
      status: 'skipped',
      reason: 'Push notifications disabled',
      metadata,
    }),
    recordDeliveryAttempt({
      notificationId: notification.id,
      userId: notification.userId,
      channel: 'fcm',
      status: 'skipped',
      reason: 'Push notifications disabled',
      metadata,
    }),
  ]);
}

async function sendApnsForNotification(params: {
  notification: PendingNotification;
  tokens: DevicePushTokenRecord[];
}): Promise<boolean> {
  const { notification, tokens } = params;
  if (tokens.length === 0) {
    await recordDeliveryAttempt({
      notificationId: notification.id,
      userId: notification.userId,
      channel: 'apns',
      status: 'skipped',
      reason: 'No active APNS token',
      metadata: { routeCode: notification.routeCode },
    });
    return false;
  }

  if (!isApnsConfigured()) {
    await recordDeliveryAttempt({
      notificationId: notification.id,
      userId: notification.userId,
      channel: 'apns',
      status: 'skipped',
      reason: 'APNS is not configured',
      metadata: { tokenCount: tokens.length },
    });
    return false;
  }

  const { title, body } = localizedTitleAndBody(notification);
  const results = await Promise.allSettled(
    tokens.map(async (token) => {
      const attemptedAt = new Date();
      const targetHash = hashDeliveryTarget({
        channel: 'apns',
        target: token.token,
      });

      try {
        const result = await sendApnsNotification({
          token,
          payload: buildApnsDeliveryPayload({
            title,
            body,
            routeCode: notification.routeCode,
            stopsAway: notification.stopsAway,
            notificationId: notification.id,
            triggerStopId: notification.triggerStopId,
            userRouteStopId: notification.routeStopId,
          }),
        });
        await recordDeliveryAttempt({
          notificationId: notification.id,
          userId: notification.userId,
          channel: 'apns',
          targetHash,
          status: result.ok ? 'succeeded' : 'failed',
          statusCode: result.status,
          reason: result.reason,
          attemptedAt,
          metadata: {
            apnsEnvironment: token.apns_environment,
            bundleId: token.bundle_id,
          },
        });
        return result.ok;
      } catch (caught) {
        const reason =
          caught instanceof Error ? caught.message : 'APNS request failed';
        await recordDeliveryAttempt({
          notificationId: notification.id,
          userId: notification.userId,
          channel: 'apns',
          targetHash,
          status: 'failed',
          reason,
          attemptedAt,
          metadata: {
            apnsEnvironment: token.apns_environment,
            bundleId: token.bundle_id,
          },
        });
        throw caught;
      }
    }),
  );

  return results.some(
    (result) => result.status === 'fulfilled' && result.value === true,
  );
}

async function sendFcmForNotification(params: {
  notification: PendingNotification;
  tokens: DevicePushTokenRecord[];
}): Promise<boolean> {
  const { notification, tokens } = params;
  if (tokens.length === 0) {
    await recordDeliveryAttempt({
      notificationId: notification.id,
      userId: notification.userId,
      channel: 'fcm',
      status: 'skipped',
      reason: 'No active FCM token',
      metadata: { routeCode: notification.routeCode },
    });
    return false;
  }

  if (!isFcmConfigured()) {
    await recordDeliveryAttempt({
      notificationId: notification.id,
      userId: notification.userId,
      channel: 'fcm',
      status: 'skipped',
      reason: 'FCM is not configured',
      metadata: { tokenCount: tokens.length },
    });
    return false;
  }

  const { title, body } = localizedTitleAndBody(notification);
  const results = await Promise.allSettled(
    tokens.map(async (token) => {
      const attemptedAt = new Date();
      const targetHash = hashDeliveryTarget({
        channel: 'fcm',
        target: token.token,
      });
      const result = await sendFcmNotification({
        token,
        payload: buildFcmDeliveryPayload({
          title,
          body,
          routeCode: notification.routeCode,
          stopsAway: notification.stopsAway,
          notificationId: notification.id,
          triggerStopId: notification.triggerStopId,
          userRouteStopId: notification.routeStopId,
        }),
      });
      await recordDeliveryAttempt({
        notificationId: notification.id,
        userId: notification.userId,
        channel: 'fcm',
        targetHash,
        status: result.ok ? 'succeeded' : 'failed',
        statusCode: result.status,
        reason: result.reason,
        attemptedAt,
        metadata: {
          packageName: token.package_name,
          messageId: result.messageId,
        },
      });
      return result.ok;
    }),
  );

  return results.some(
    (result) => result.status === 'fulfilled' && result.value === true,
  );
}

async function sendLineFallback(notification: PendingNotification): Promise<void> {
  if (!notification.providerUid) {
    await recordDeliveryAttempt({
      notificationId: notification.id,
      userId: notification.userId,
      channel: 'line',
      status: 'skipped',
      reason: 'No LINE provider UID',
      metadata: { routeCode: notification.routeCode },
    });
    return;
  }

  const attemptedAt = new Date();
  const targetHash = hashDeliveryTarget({
    channel: 'line',
    target: notification.providerUid,
  });

  try {
    await sendLinePushShuttleCarousel({
      to: notification.providerUid,
      language: notification.preferredLanguage,
      routeCode: notification.routeCode,
      stopsAway: notification.stopsAway,
    });
    await recordDeliveryAttempt({
      notificationId: notification.id,
      userId: notification.userId,
      channel: 'line',
      targetHash,
      status: 'succeeded',
      attemptedAt,
      metadata: { routeCode: notification.routeCode },
    });
  } catch (caught) {
    const reason =
      caught instanceof Error ? caught.message : 'LINE push request failed';
    await recordDeliveryAttempt({
      notificationId: notification.id,
      userId: notification.userId,
      channel: 'line',
      targetHash,
      status: 'failed',
      reason,
      attemptedAt,
      metadata: { routeCode: notification.routeCode },
    });
    throw caught;
  }
}

async function sendPushNotifications(
  notifications: PendingNotification[],
): Promise<void> {
  const pushTokensByUserId = await fetchActiveDevicePushTokensForUsers(
    notifications.map((notification) => notification.userId),
  );
  const concurrency = 10;

  for (let index = 0; index < notifications.length; index += concurrency) {
    const batch = notifications.slice(index, index + concurrency);
    const results = await Promise.allSettled(
      batch.map(async (notification) => {
        if (!notification.externalPushEnabled) {
          await recordExternalPushDisabled(notification);
          return;
        }

        const tokens = pushTokensByUserId.get(notification.userId) ?? [];
        const apnsTokens = tokens.filter((token) => token.platform === 'ios');
        const fcmTokens = tokens.filter((token) => token.platform === 'android');
        const deliveredViaApns = await sendApnsForNotification({
          notification,
          tokens: apnsTokens,
        });

        if (deliveredViaApns) {
          return;
        }

        const deliveredViaFcm = await sendFcmForNotification({
          notification,
          tokens: fcmTokens,
        });

        if (deliveredViaFcm) {
          return;
        }

        await sendLineFallback(notification);
      }),
    );

    results.forEach((result, batchIndex) => {
      if (result.status === 'fulfilled') return;

      const notification = batch[batchIndex];
      logError('[notifications] external delivery failed', {
        userId: notification.userId,
        routeStopId: notification.routeStopId,
        message:
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
      });
    });
  }
}

export async function notifyApproachingUsers(
  runId: string,
  arrivedRouteStopId: string,
): Promise<void> {
  const arrived = await query<ArrivedStopRow>(
    `SELECT
       rs.sequence,
       rs.route_id,
       r.route_code
     FROM route_stops rs
     JOIN routes r ON r.id = rs.route_id
     WHERE rs.id = $1
     LIMIT 1`,
    [arrivedRouteStopId],
  ).then((rows) => rows[0] ?? null);
  if (!arrived) return;

  const nextStops = await query<NextStopRow>(
    `SELECT
       rs.id,
       rs.sequence
     FROM route_stops rs
     WHERE rs.route_id = $1
       AND rs.active = true
       AND rs.sequence IN ($2, $3)
     ORDER BY rs.sequence ASC`,
    [arrived.route_id, arrived.sequence + 1, arrived.sequence + 2],
  );
  const targetStops = nextStops
    .map((stop) => ({
      id: stop.id,
      stopsAway: (stop.sequence - arrived.sequence) as 1 | 2,
    }))
    .filter(
      (stop): stop is { id: string; stopsAway: 1 | 2 } =>
        stop.stopsAway === 1 || stop.stopsAway === 2,
    );
  if (targetStops.length === 0) return;

  const placeholders = targetStops.map((_, index) => `$${index + 1}`).join(', ');
  const users = await query<TargetUserRow>(
    `SELECT
       ur.user_id,
       ur.route_stop_id,
       ui.provider_uid,
       COALESCE(u.preferred_language, 'ko')::text AS preferred_language,
       u.push_notifications_enabled
     FROM user_registrations ur
     JOIN users u ON u.id = ur.user_id
     LEFT JOIN user_identities ui
       ON ui.user_id = ur.user_id
      AND ui.provider = 'line'
     WHERE ur.route_stop_id IN (${placeholders})
       AND ur.status = 'active'`,
    targetStops.map((stop) => stop.id),
  );
  if (users.length === 0) return;

  const stopsAwayByRouteStopId = new Map(
    targetStops.map((stop) => [stop.id, stop.stopsAway]),
  );
  const pendingNotifications = users.flatMap<PendingNotification>((user) => {
    const stopsAway = stopsAwayByRouteStopId.get(user.route_stop_id);
    if (!stopsAway) return [];

    const template = buildApproachingTemplate(stopsAway);
    return [
      {
        id: randomUUID(),
        userId: user.user_id,
        providerUid: user.provider_uid,
        preferredLanguage: user.preferred_language === 'en' ? 'en' : 'ko',
        externalPushEnabled: user.push_notifications_enabled,
        routeStopId: user.route_stop_id,
        triggerStopId: arrivedRouteStopId,
        routeCode: arrived.route_code,
        stopsAway,
        titleKo: template.titleKo,
        bodyKo: template.bodyKo,
        titleEn: template.titleEn,
        bodyEn: template.bodyEn,
      },
    ];
  });
  if (pendingNotifications.length === 0) return;

  const insertColumnCount = 11;
  const insertValues = pendingNotifications.flatMap((notification) => [
    notification.id,
    notification.userId,
    runId,
    arrivedRouteStopId,
    notification.stopsAway,
    notification.titleKo,
    notification.bodyKo,
    notification.titleEn,
    notification.bodyEn,
    notification.routeCode,
    notification.routeStopId,
  ]);

  const insertedRows = await query<{
    user_id: string;
    user_route_stop_id: string;
  }>(
    `INSERT INTO notifications
       (id, user_id, run_id, trigger_stop_id, stops_away,
        title_ko, body_ko, title_en, body_en,
        route_code, user_route_stop_id)
     VALUES ${buildInsertPlaceholders(pendingNotifications.length, insertColumnCount)}
     ON CONFLICT (user_id, run_id, trigger_stop_id) DO NOTHING
     RETURNING user_id, user_route_stop_id`,
    insertValues,
  );
  if (insertedRows.length === 0) return;

  const insertedKeys = new Set(
    insertedRows.map((row) => `${row.user_id}:${row.user_route_stop_id}`),
  );
  const pushTargets = pendingNotifications.filter((notification) =>
    insertedKeys.has(`${notification.userId}:${notification.routeStopId}`),
  );

  await sendPushNotifications(pushTargets);
}
