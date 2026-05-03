import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveApnsEnvironment } from '@/server/push-tokens';
import {
  computePushJobRetryDelaySeconds,
  normalizePushJobLimit,
} from '@/server/push-jobs';
import {
  buildApnsDeliveryPayload,
  buildApproachingTemplate,
  buildFcmDeliveryPayload,
  buildNotificationDeepLinkPath,
  hashDeliveryTarget,
} from '@/server/notifications';

test('resolveApnsEnvironment honors explicit values', () => {
  assert.equal(resolveApnsEnvironment('sandbox'), 'sandbox');
  assert.equal(resolveApnsEnvironment('production'), 'production');
});

test('buildApproachingTemplate uses stop-aware copy in Korean and English', () => {
  const template = buildApproachingTemplate(2);

  assert.equal(template.titleKo, '도착 알림');
  assert.match(template.bodyKo, /2 정거장/);
  assert.equal(template.titleEn, 'Arrival alert');
  assert.match(template.bodyEn, /2 stops away/);
});

test('buildNotificationDeepLinkPath points to route and user stop', () => {
  assert.equal(
    buildNotificationDeepLinkPath({
      routeCode: 'south-a-r1',
      userRouteStopId: 'route-stop-1',
    }),
    '/?route=south-a-r1&stop=route-stop-1',
  );
});

test('buildApnsDeliveryPayload includes navigation fields', () => {
  const payload = buildApnsDeliveryPayload({
    notificationId: 'notification-1',
    triggerStopId: 'trigger-stop-1',
    userRouteStopId: 'user-stop-1',
    routeCode: 'south-a-r1',
    stopsAway: 1,
    title: 'Arrival alert',
    body: 'Get ready',
  });

  assert.equal(payload.notificationId, 'notification-1');
  assert.equal(payload.triggerStopId, 'trigger-stop-1');
  assert.equal(payload.userRouteStopId, 'user-stop-1');
  assert.equal(payload.deepLinkPath, '/?route=south-a-r1&stop=user-stop-1');
});

test('buildFcmDeliveryPayload mirrors APNS navigation fields', () => {
  const payload = buildFcmDeliveryPayload({
    notificationId: 'notification-1',
    triggerStopId: 'trigger-stop-1',
    userRouteStopId: 'user-stop-1',
    routeCode: 'south-a-r1',
    stopsAway: 2,
    title: 'Arrival alert',
    body: 'Get ready',
  });

  assert.equal(payload.notificationId, 'notification-1');
  assert.equal(payload.triggerStopId, 'trigger-stop-1');
  assert.equal(payload.userRouteStopId, 'user-stop-1');
  assert.equal(payload.deepLinkPath, '/?route=south-a-r1&stop=user-stop-1');
});

test('hashDeliveryTarget supports FCM without exposing tokens', () => {
  const rawTarget = 'fcm-registration-token';
  const hash = hashDeliveryTarget({ channel: 'fcm', target: rawTarget });

  assert.equal(hash.length, 64);
  assert.notEqual(hash, rawTarget);
});

test('hashDeliveryTarget does not expose raw external identifiers', () => {
  const rawTarget = 'line-user-id';
  const hash = hashDeliveryTarget({ channel: 'line', target: rawTarget });

  assert.equal(hash.length, 64);
  assert.notEqual(hash, rawTarget);
  assert.equal(
    hash,
    hashDeliveryTarget({ channel: 'line', target: rawTarget }),
  );
});

test('normalizePushJobLimit keeps worker batches bounded', () => {
  assert.equal(normalizePushJobLimit(null), 10);
  assert.equal(normalizePushJobLimit('0'), 10);
  assert.equal(normalizePushJobLimit('7'), 7);
  assert.equal(normalizePushJobLimit('500'), 50);
});

test('computePushJobRetryDelaySeconds backs off with a five minute cap', () => {
  assert.equal(computePushJobRetryDelaySeconds(1), 30);
  assert.equal(computePushJobRetryDelaySeconds(2), 60);
  assert.equal(computePushJobRetryDelaySeconds(4), 240);
  assert.equal(computePushJobRetryDelaySeconds(12), 300);
});
