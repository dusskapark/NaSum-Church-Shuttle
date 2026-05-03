import { timingSafeEqual } from 'node:crypto';
import { NextRequest } from 'next/server';
import { env } from '@/server/env';
import { error, json } from '@/server/http';
import {
  normalizePushJobLimit,
  processPushNotificationJobs,
} from '@/server/push-jobs';

export const dynamic = 'force-dynamic';

function safeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function requireWorkerSecret(request: NextRequest) {
  if (!env.CRON_SECRET) {
    return error(503, 'CRON_SECRET is not configured');
  }

  const authorization = request.headers.get('authorization');
  const bearerToken = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : null;
  const headerToken = request.headers.get('x-cron-secret');
  const token = bearerToken ?? headerToken;

  if (!token || !safeEquals(token, env.CRON_SECRET)) {
    return error(401, 'Unauthorized');
  }

  return null;
}

async function handle(request: NextRequest) {
  const authError = requireWorkerSecret(request);
  if (authError) return authError;

  const limit = normalizePushJobLimit(request.nextUrl.searchParams.get('limit'));
  const result = await processPushNotificationJobs(limit);
  return json(result);
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
