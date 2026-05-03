import { connect, constants } from 'node:http2';
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
  userRouteStopId: string;
  deepLinkPath: string;
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

function parseApnsErrorBody(bodyText: string): { reason?: string } {
  try {
    return JSON.parse(bodyText || '{}') as { reason?: string };
  } catch {
    return {};
  }
}

async function postApnsRequest(params: {
  host: string;
  deviceToken: string;
  bearerToken: string;
  topic: string;
  body: string;
}): Promise<{ status: number; bodyText: string }> {
  return new Promise((resolve, reject) => {
    const client = connect(params.host);
    let settled = false;

    const settle = (
      callback: () => void,
      error?: Error,
    ) => {
      if (settled) return;
      settled = true;
      client.close();
      if (error) {
        reject(error);
      } else {
        callback();
      }
    };

    client.once('error', (err) => {
      settle(() => undefined, err);
    });

    const request = client.request({
      [constants.HTTP2_HEADER_METHOD]: constants.HTTP2_METHOD_POST,
      [constants.HTTP2_HEADER_PATH]: `/3/device/${params.deviceToken}`,
      authorization: `bearer ${params.bearerToken}`,
      'apns-topic': params.topic,
      'apns-push-type': 'alert',
      'content-type': 'application/json',
    });

    let status = 0;
    const chunks: Buffer[] = [];

    request.setEncoding('utf8');
    request.on('response', (headers) => {
      const rawStatus = headers[constants.HTTP2_HEADER_STATUS];
      status = typeof rawStatus === 'number' ? rawStatus : Number(rawStatus ?? 0);
    });
    request.on('data', (chunk) => {
      chunks.push(Buffer.from(chunk));
    });
    request.once('error', (err) => {
      settle(() => undefined, err);
    });
    request.once('end', () => {
      settle(() => {
        resolve({
          status,
          bodyText: Buffer.concat(chunks).toString('utf8'),
        });
      });
    });

    request.end(params.body);
  });
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
  const response = await postApnsRequest({
    host: getApnsHost(params.token.apns_environment),
    deviceToken: params.token.token,
    bearerToken,
    topic,
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
      userRouteStopId: params.payload.userRouteStopId,
      deepLinkPath: params.payload.deepLinkPath,
    }),
  });

  if (response.status >= 200 && response.status < 300) {
    return {
      ok: true,
      status: response.status,
    };
  }

  const body = parseApnsErrorBody(response.bodyText);
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
