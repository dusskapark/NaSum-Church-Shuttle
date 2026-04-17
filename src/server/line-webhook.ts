import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from './env';
import { logError } from '@/lib/logger';

const WEBHOOK_KEYWORDS = [
  '셔틀',
  '버스',
  '탑승',
  '노선',
  'shuttle',
  'bus',
  'route',
] as const;

export interface LineWebhookEvent {
  type?: string;
  replyToken?: string;
  message?: {
    type?: string;
    text?: string;
  };
}

export interface LineWebhookBody {
  destination?: string;
  events?: LineWebhookEvent[];
}

export function verifyLineWebhookSignature(params: {
  signatureHeader: string | null;
  bodyText: string;
  channelSecret: string | undefined;
}): boolean {
  const { signatureHeader, bodyText, channelSecret } = params;

  if (!signatureHeader || !channelSecret) {
    return false;
  }

  const digest = createHmac('sha256', channelSecret)
    .update(bodyText)
    .digest('base64');

  const expected = Buffer.from(digest);
  const received = Buffer.from(signatureHeader);

  if (expected.length !== received.length) {
    return false;
  }

  return timingSafeEqual(expected, received);
}

export function hasShuttleKeyword(rawText: string): boolean {
  const normalized = rawText.toLowerCase().trim();
  if (!normalized) {
    return false;
  }

  return WEBHOOK_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

export interface ShuttleLiffUrls {
  scanUrl: string;
  homeUrl: string;
}

export function buildShuttleLiffUrls(): ShuttleLiffUrls | null {
  const liffId = env.NEXT_PUBLIC_LIFF_ID?.trim();
  if (liffId) {
    return {
      scanUrl: `https://liff.line.me/${liffId}/scan`,
      homeUrl: `https://liff.line.me/${liffId}`,
    };
  }

  const appUrl = env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) {
    const normalized = appUrl.replace(/\/$/, '');
    return {
      scanUrl: `${normalized}/scan`,
      homeUrl: normalized,
    };
  }

  logError(
    '[LINE webhook] LIFF URL configuration missing: NEXT_PUBLIC_LIFF_ID or NEXT_PUBLIC_APP_URL is required',
  );
  return null;
}

export function parseLineWebhookBody(bodyText: string): LineWebhookBody | null {
  try {
    return JSON.parse(bodyText) as LineWebhookBody;
  } catch {
    return null;
  }
}
