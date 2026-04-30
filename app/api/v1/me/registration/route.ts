import { NextRequest, NextResponse } from 'next/server';
import { error, json, requireActor } from '@/server/http';
import {
  deactivateRegistrationForUser,
  fetchRegistrationResponseByUserId,
  upsertRegistrationForUser,
} from '@/server/registrations';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const actor = await requireActor(request);
  if (actor instanceof NextResponse) return actor;

  const response = await fetchRegistrationResponseByUserId(actor.userId);
  return json(response);
}

export async function PUT(request: NextRequest) {
  const actor = await requireActor(request);
  if (actor instanceof NextResponse) return actor;

  const body = (await request.json()) as {
    route_code?: string;
    route_stop_id?: string;
  };

  if (!body.route_code || !body.route_stop_id) {
    return error(400, 'route_code and route_stop_id are required');
  }

  try {
    const result = await upsertRegistrationForUser({
      userId: actor.userId,
      routeCode: body.route_code,
      routeStopId: body.route_stop_id,
    });

    return json(
      {
        success: true,
        registration_id: result.registrationId,
      },
      { status: 201 },
    );
  } catch (caught) {
    const status = (caught as { status?: number }).status ?? 500;
    const message =
      caught instanceof Error ? caught.message : 'Failed to update registration';
    return error(status, message);
  }
}

export async function DELETE(request: NextRequest) {
  const actor = await requireActor(request);
  if (actor instanceof NextResponse) return actor;

  const deactivated = await deactivateRegistrationForUser(actor.userId);
  return json({
    success: true,
    registration_id: deactivated?.id ?? null,
  });
}
