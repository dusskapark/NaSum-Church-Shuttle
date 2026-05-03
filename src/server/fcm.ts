import { cert, getApps, initializeApp, type ServiceAccount } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { env } from './env';
import {
  deactivateDevicePushToken,
  type DevicePushTokenRecord,
} from './push-tokens';

export interface FcmDeliveryPayload {
  title: string;
  body: string;
  routeCode: string;
  stopsAway: 1 | 2;
  notificationId: string;
  triggerStopId: string;
  userRouteStopId: string;
  deepLinkPath: string;
}

export interface FcmDeliveryResult {
  ok: boolean;
  status: number;
  reason?: string;
  messageId?: string;
}

function decodeBase64(value: string): string {
  return Buffer.from(value.trim(), 'base64').toString('utf8').trim();
}

function firebaseServiceAccount(): ServiceAccount | null {
  if (env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64) {
    return JSON.parse(
      decodeBase64(env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64),
    ) as ServiceAccount;
  }

  if (
    !env.FIREBASE_PROJECT_ID ||
    !env.FIREBASE_CLIENT_EMAIL ||
    !env.FIREBASE_PRIVATE_KEY_BASE64
  ) {
    return null;
  }

  return {
    projectId: env.FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey: decodeBase64(env.FIREBASE_PRIVATE_KEY_BASE64).replace(/\\n/g, '\n'),
  };
}

export function isFcmConfigured(): boolean {
  return Boolean(firebaseServiceAccount());
}

function messaging() {
  const account = firebaseServiceAccount();
  if (!account) {
    throw new Error('Firebase Cloud Messaging is not configured');
  }

  const app =
    getApps().find((candidate) => candidate.name === 'nasum-shuttle') ??
    initializeApp(
      {
        credential: cert(account),
      },
      'nasum-shuttle',
    );

  return getMessaging(app);
}

function errorCode(caught: unknown): string | undefined {
  if (typeof caught !== 'object' || caught === null) return undefined;
  const candidate = caught as { code?: unknown };
  return typeof candidate.code === 'string' ? candidate.code : undefined;
}

function errorMessage(caught: unknown): string {
  return caught instanceof Error ? caught.message : 'FCM request failed';
}

export async function sendFcmNotification(params: {
  token: DevicePushTokenRecord;
  payload: FcmDeliveryPayload;
}): Promise<FcmDeliveryResult> {
  if (!isFcmConfigured()) {
    return {
      ok: false,
      status: 0,
      reason: 'FCM is not configured',
    };
  }

  try {
    const messageId = await messaging().send({
      token: params.token.token,
      notification: {
        title: params.payload.title,
        body: params.payload.body,
      },
      data: {
        notificationId: params.payload.notificationId,
        routeCode: params.payload.routeCode,
        stopsAway: String(params.payload.stopsAway),
        triggerStopId: params.payload.triggerStopId,
        userRouteStopId: params.payload.userRouteStopId,
        deepLinkPath: params.payload.deepLinkPath,
      },
      android: {
        notification: {
          channelId: 'shuttle_alerts',
          sound: 'default',
        },
      },
    });

    return {
      ok: true,
      status: 200,
      messageId,
    };
  } catch (caught) {
    const code = errorCode(caught);
    if (
      code === 'messaging/registration-token-not-registered' ||
      code === 'messaging/invalid-registration-token'
    ) {
      await deactivateDevicePushToken({ token: params.token.token }).catch(() => {});
    }

    return {
      ok: false,
      status: 0,
      reason: code ? `${code}: ${errorMessage(caught)}` : errorMessage(caught),
    };
  }
}
