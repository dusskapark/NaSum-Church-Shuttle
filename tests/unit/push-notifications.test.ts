import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveApnsEnvironment } from '@/server/push-tokens';
import { buildApproachingTemplate } from '@/server/notifications';

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
