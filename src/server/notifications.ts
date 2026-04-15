import { randomUUID } from 'node:crypto';
import { query } from './db';
import { sendLinePushText } from './line-messaging';

interface ArrivedStopRow {
  sequence: number;
  route_id: string;
  route_code: string;
  route_label: string;
}

interface NextStopRow {
  id: string;
  sequence: number;
}

interface TargetUserRow {
  user_id: string;
  provider_uid: string;
  preferred_language: 'ko' | 'en';
}

interface NotificationTemplate {
  titleKo: string;
  bodyKo: string;
  titleEn: string;
  bodyEn: string;
}

function buildApproachingTemplate(
  stopsAway: 1 | 2,
  routeLabel: string,
): NotificationTemplate {
  if (stopsAway === 1) {
    return {
      titleKo: '곧 탑승 정류장에 도착합니다',
      bodyKo: `${routeLabel} 셔틀이 바로 전 정류장에 도착했습니다. 탑승을 준비하세요.`,
      titleEn: 'Your stop is next',
      bodyEn: `${routeLabel} shuttle has arrived at the previous stop. Please get ready to board.`,
    };
  }

  return {
    titleKo: '셔틀이 2정거장 전입니다',
    bodyKo: `${routeLabel} 셔틀이 두 정류장 전에 도착했습니다.`,
    titleEn: 'Shuttle is 2 stops away',
    bodyEn: `${routeLabel} shuttle is now 2 stops away from your stop.`,
  };
}

function buildLinePushText(
  language: 'ko' | 'en',
  template: NotificationTemplate,
): string {
  return language === 'ko'
    ? `${template.titleKo}\n${template.bodyKo}`
    : `${template.titleEn}\n${template.bodyEn}`;
}

export async function notifyApproachingUsers(
  runId: string,
  arrivedRouteStopId: string,
): Promise<void> {
  const arrived = await query<ArrivedStopRow>(
    `SELECT
       rs.sequence,
       rs.route_id,
       r.route_code,
       COALESCE(NULLIF(r.display_name, ''), NULLIF(r.name, ''), r.route_code) AS route_label
     FROM route_stops rs
     JOIN routes r ON r.id = rs.route_id
     WHERE rs.id = $1
     LIMIT 1`,
    [arrivedRouteStopId],
  ).then((rows) => rows[0] ?? null);
  if (!arrived) return;

  const nextStops = await query<NextStopRow>(
    `SELECT id, sequence
     FROM route_stops
     WHERE route_id = $1
       AND active = true
       AND sequence IN ($2, $3)`,
    [arrived.route_id, arrived.sequence + 1, arrived.sequence + 2],
  );
  if (nextStops.length === 0) return;

  for (const nextStop of nextStops) {
    const stopsAway = (nextStop.sequence - arrived.sequence) as 1 | 2;
    if (stopsAway !== 1 && stopsAway !== 2) continue;

    const users = await query<TargetUserRow>(
      `SELECT
         ur.user_id,
         ui.provider_uid,
         COALESCE(u.preferred_language, 'ko')::text AS preferred_language
       FROM user_registrations ur
       JOIN users u ON u.id = ur.user_id
       JOIN user_identities ui
         ON ui.user_id = ur.user_id
        AND ui.provider = 'line'
       WHERE ur.route_stop_id = $1
         AND ur.status = 'active'
         AND u.push_notifications_enabled = true`,
      [nextStop.id],
    );

    const template = buildApproachingTemplate(stopsAway, arrived.route_label);

    for (const user of users) {
      const inserted = await query<{ id: string }>(
        `INSERT INTO notifications
           (id, user_id, run_id, trigger_stop_id, stops_away,
            title_ko, body_ko, title_en, body_en,
            route_code, user_route_stop_id)
         VALUES
           ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (user_id, run_id, trigger_stop_id) DO NOTHING
         RETURNING id`,
        [
          randomUUID(),
          user.user_id,
          runId,
          arrivedRouteStopId,
          stopsAway,
          template.titleKo,
          template.bodyKo,
          template.titleEn,
          template.bodyEn,
          arrived.route_code,
          nextStop.id,
        ],
      ).then((rows) => rows[0] ?? null);

      if (!inserted) continue;

      const lang = user.preferred_language === 'en' ? 'en' : 'ko';
      sendLinePushText(user.provider_uid, buildLinePushText(lang, template)).catch(
        (caught) => {
          console.error('[notifications] LINE push failed', {
            runId,
            arrivedRouteStopId,
            userId: user.user_id,
            message: caught instanceof Error ? caught.message : String(caught),
          });
        },
      );
    }
  }
}
