import { randomUUID } from 'node:crypto';
import { query } from './db';
import { sendLinePushShuttleCarousel } from './line-messaging';
import { logError } from '@/lib/logger';
import { fetchActiveDevicePushTokensForUsers } from './push-tokens';
import { isApnsConfigured, sendApnsNotification } from './apns';

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
  routeStopId: string;
  routeCode: string;
  stopsAway: 1 | 2;
  titleKo: string;
  bodyKo: string;
  titleEn: string;
  bodyEn: string;
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
        const title =
          notification.preferredLanguage === 'en'
            ? notification.titleEn
            : notification.titleKo;
        const body =
          notification.preferredLanguage === 'en'
            ? notification.bodyEn
            : notification.bodyKo;
        const apnsTokens = pushTokensByUserId.get(notification.userId) ?? [];

        if (isApnsConfigured() && apnsTokens.length > 0) {
          const apnsResults = await Promise.allSettled(
            apnsTokens.map((token) =>
              sendApnsNotification({
                token,
                payload: {
                  title,
                  body,
                  routeCode: notification.routeCode,
                  stopsAway: notification.stopsAway,
                  notificationId: notification.id,
                  triggerStopId: notification.routeStopId,
                },
              }),
            ),
          );
          const deliveredViaApns = apnsResults.some(
            (result) => result.status === 'fulfilled' && result.value.ok,
          );
          if (deliveredViaApns) {
            return;
          }
        }

        if (!notification.providerUid) {
          throw new Error('No APNS token or LINE provider UID available');
        }

        await sendLinePushShuttleCarousel({
          to: notification.providerUid,
          language: notification.preferredLanguage,
          routeCode: notification.routeCode,
          stopsAway: notification.stopsAway,
        });
      }),
    );

    results.forEach((result, batchIndex) => {
      if (result.status === 'fulfilled') return;

      const notification = batch[batchIndex];
      logError('[notifications] LINE push failed', {
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
       COALESCE(u.preferred_language, 'ko')::text AS preferred_language
     FROM user_registrations ur
     JOIN users u ON u.id = ur.user_id
     LEFT JOIN user_identities ui
       ON ui.user_id = ur.user_id
      AND ui.provider = 'line'
     WHERE ur.route_stop_id IN (${placeholders})
       AND ur.status = 'active'
       AND u.push_notifications_enabled = true`,
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
        routeStopId: user.route_stop_id,
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
