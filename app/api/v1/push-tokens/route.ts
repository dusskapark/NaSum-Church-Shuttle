import { NextRequest, NextResponse } from 'next/server';
import { error, json, requireActor } from '@/server/http';
import { upsertDevicePushToken } from '@/server/push-tokens';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const actor = await requireActor(request);
  if (actor instanceof NextResponse) return actor;

  const body = (await request.json()) as {
    token?: string;
    platform?: 'ios' | 'android' | null;
    bundle_id?: string | null;
    apns_environment?: 'sandbox' | 'production' | null;
    package_name?: string | null;
  };

  if (!body.token) {
    return error(400, 'token is required');
  }

  try {
    const pushToken = await upsertDevicePushToken({
      userId: actor.userId,
      token: body.token,
      platform: body.platform,
      bundleId: body.bundle_id,
      apnsEnvironment: body.apns_environment,
      packageName: body.package_name,
    });
    return json({
      success: true,
      id: pushToken.id,
      platform: pushToken.platform,
      token: pushToken.token,
      bundle_id: pushToken.bundle_id,
      apns_environment: pushToken.apns_environment,
      package_name: pushToken.package_name,
      is_active: pushToken.is_active,
      updated_at: pushToken.updated_at,
    });
  } catch (caught) {
    const message =
      caught instanceof Error ? caught.message : 'Failed to register push token';
    return error(400, message);
  }
}
