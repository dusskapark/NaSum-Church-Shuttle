import { NextRequest, NextResponse } from 'next/server';
import { logError } from '@/lib/logger';
import { env } from '@/server/env';
import { sendLineReplyTemplate } from '@/server/line-messaging';
import {
  buildShuttleLiffUrl,
  hasShuttleKeyword,
  parseLineWebhookBody,
  verifyLineWebhookSignature,
} from '@/server/line-webhook';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const bodyText = await request.text();
  const signature = request.headers.get('x-line-signature');

  const isValidSignature = verifyLineWebhookSignature({
    signatureHeader: signature,
    bodyText,
    channelSecret: env.MESSAGING_API_CHANNEL_SECRET,
  });

  if (!isValidSignature) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = parseLineWebhookBody(bodyText);
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const events = Array.isArray(body.events) ? body.events : [];

  for (const event of events) {
    if (event.type !== 'message' || event.message?.type !== 'text') {
      continue;
    }

    const text = event.message.text ?? '';
    if (!hasShuttleKeyword(text)) {
      continue;
    }

    if (!event.replyToken) {
      continue;
    }

    const liffUrl = buildShuttleLiffUrl();
    if (!liffUrl) {
      continue;
    }

    try {
      await sendLineReplyTemplate({
        replyToken: event.replyToken,
        liffUrl,
      });
    } catch (caughtError) {
      logError('[LINE webhook] reply failed', {
        message:
          caughtError instanceof Error ? caughtError.message : 'Unknown error',
      });
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

function methodNotAllowed(): NextResponse {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
}

export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const HEAD = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
