import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { hasShuttleKeyword, verifyLineWebhookSignature } from '@/server/line-webhook';

test('verifyLineWebhookSignature returns true for valid signature', () => {
  const bodyText = JSON.stringify({ events: [] });
  const channelSecret = 'test-channel-secret';
  const signature = createHmac('sha256', channelSecret)
    .update(bodyText)
    .digest('base64');

  const result = verifyLineWebhookSignature({
    signatureHeader: signature,
    bodyText,
    channelSecret,
  });

  assert.equal(result, true);
});

test('verifyLineWebhookSignature returns false for invalid signature', () => {
  const result = verifyLineWebhookSignature({
    signatureHeader: 'invalid-signature',
    bodyText: JSON.stringify({ events: [] }),
    channelSecret: 'test-channel-secret',
  });

  assert.equal(result, false);
});

test('hasShuttleKeyword matches Korean and English keywords with casing and whitespace', () => {
  assert.equal(hasShuttleKeyword('  셔틀 버스 시간표 알려줘  '), true);
  assert.equal(hasShuttleKeyword('Need SHUTTLE route details'), true);
  assert.equal(hasShuttleKeyword('hello there'), false);
});
