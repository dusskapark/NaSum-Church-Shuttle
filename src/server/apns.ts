import { importPKCS8, SignJWT } from 'jose';
import { env } from './env';
import { deactivateDevicePushToken, type DevicePushTokenRecord } from './push-tokens';

export interface ApnsDeliveryPayload {
  title: string;
  body: string;
  routeCode: string;
  stopsAway: 1 | 2;
  notificationId: string;
  triggerStopId: string;
}

export interface ApnsDeliveryResult {
  ok: boolean;
  status: number;
  reason?: string;
}

function getApnsPrivateKey(): string {
  const encoded = env.APNS_PRIVATE_KEY_BASE64?.trim();
  if (!encoded) {
    throw new Error('APNS_PRIVATE_KEY_BASE64 is not configured');
  }

  const decoded = Buffer.from(encoded, 'base64').toString('utf8').trim();
  if (!decoded) {
    throw new Error('APNS_PRIVATE_KEY_BASE64 decoded to an empty key');
  }

  return decoded.includes('BEGIN PRIVATE KEY')
    ? decoded
    : decoded.replace(/\\n/g, '\n');
}

function getApnsHost(environment: DevicePushTokenRecord['apns_environment']): string {
  return environment === 'production'
    ? 'https://api.push.apple.com'
    : 'https://api.sandbox.push.apple.com';
}

export function isApnsConfigured(): boolean {
  return Boolean(
    env.APNS_BUNDLE_ID &&
      env.APNS_TEAM_ID &&
      env.APNS_KEY_ID &&
      env.APNS_PRIVATE_KEY_BASE64,
  );
}

async function createApnsBearerToken(): Promise<string> {
  const teamId = env.APNS_TEAM_ID;
  const keyId = env.APNS_KEY_ID;
  if (!teamId || !keyId) {
    throw new Error('APNS_TEAM_ID and APNS_KEY_ID are required');
  }

  const privateKey = await importPKCS8(getApnsPrivateKey(), 'ES256');
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt()
    .sign(privateKey);
}

export async function sendApnsNotification(params: {
  token: DevicePushTokenRecord;
  payload: ApnsDeliveryPayload;
}): Promise<ApnsDeliveryResult> {
  if (!isApnsConfigured()) {
    return {
      ok: false,
      status: 0,
      reason: 'APNS is not configured',
    };
  }

  const bearerToken = await createApnsBearerToken();
  const topic = params.token.bundle_id || env.APNS_BUNDLE_ID!;
  const response = await fetch(
    `${getApnsHost(params.token.apns_environment)}/3/device/${params.token.token}`,
    {
      method: 'POST',
      headers: {
        authorization: `bearer ${bearerToken}`,
        'apns-topic': topic,
        'apns-push-type': 'alert',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        aps: {
          alert: {
            title: params.payload.title,
            body: params.payload.body,
          },
          sound: 'default',
        },
        notificationId: params.payload.notificationId,
        routeCode: params.payload.routeCode,
        stopsAway: params.payload.stopsAway,
        triggerStopId: params.payload.triggerStopId,
      }),
    },
  );

  if (response.ok) {
    return {
      ok: true,
      status: response.status,
    };
  }

  const body = (await response.json().catch(() => ({}))) as { reason?: string };
  const reason = body.reason ?? 'APNS request failed';
  if (
    reason === 'BadDeviceToken' ||
    reason === 'DeviceTokenNotForTopic' ||
    reason === 'Unregistered'
  ) {
    await deactivateDevicePushToken({ token: params.token.token }).catch(() => {});
  }

  return {
    ok: false,
    status: response.status,
    reason,
  };
}
