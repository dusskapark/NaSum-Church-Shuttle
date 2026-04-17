import { randomUUID } from 'node:crypto';
import { query } from './db';
import { sendLinePushShuttleCarousel } from './line-messaging';

interface ArrivedStopRow {
  sequence: number;
  route_id: string;
  route_code: string;
  route_label: string;
  arrived_stop_name: string;
}

interface NextStopRow {
  id: string;
  sequence: number;
  stop_name: string;
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
  _routeLabel: string,
): NotificationTemplate {
  return {
    titleKo: '도착 알림',
    bodyKo: `셔틀이 ${stopsAway}정거장 전입니다.\n탑승을 준비하세요.`,
    titleEn: 'Arrival alert',
    bodyEn: `Shuttle is ${stopsAway} stop${stopsAway > 1 ? 's' : ''} away.\nPlease get ready to board.`,
  };
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
       COALESCE(NULLIF(r.display_name, ''), NULLIF(r.name, ''), r.route_code) AS route_label,
       COALESCE(NULLIF(p.display_name, ''), NULLIF(p.name, ''), CONCAT('Stop ', rs.sequence::text)) AS arrived_stop_name
     FROM route_stops rs
     JOIN routes r ON r.id = rs.route_id
     JOIN places p ON p.id = rs.place_id
     WHERE rs.id = $1
     LIMIT 1`,
    [arrivedRouteStopId],
  ).then((rows) => rows[0] ?? null);
  if (!arrived) return;

  const nextStops = await query<NextStopRow>(
    `SELECT
       rs.id,
       rs.sequence,
       COALESCE(NULLIF(p.display_name, ''), NULLIF(p.name, ''), CONCAT('Stop ', rs.sequence::text)) AS stop_name
     FROM route_stops rs
     JOIN places p ON p.id = rs.place_id
     WHERE rs.route_id = $1
       AND rs.active = true
       AND rs.sequence IN ($2, $3)
     ORDER BY rs.sequence ASC`,
    [arrived.route_id, arrived.sequence + 1, arrived.sequence + 2],
  );
  if (nextStops.length === 0) return;

  const stopBySequence = new Map(nextStops.map((stop) => [stop.sequence, stop]));

  for (const nextStop of nextStops) {
    const stopsAway = (nextStop.sequence - arrived.sequence) as 1 | 2;
    if (stopsAway !== 1 && stopsAway !== 2) continue;
    const intermediateStopName =
      stopsAway === 2
        ? stopBySequence.get(arrived.sequence + 1)?.stop_name ?? null
        : null;

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
      sendLinePushShuttleCarousel({
        to: user.provider_uid,
        language: lang,
        routeLabel: arrived.route_label,
        arrivedStopName: arrived.arrived_stop_name,
        targetStopName: nextStop.stop_name,
        intermediateStopName,
        stopsAway,
      }).catch(
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
