import { NextRequest } from 'next/server';
import { handleAdminSchedules } from '../../../../../../_handlers';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ scheduleId: string; routeId: string; sequence: string }> },
) {
  const { scheduleId, routeId, sequence } = await params;
  return handleAdminSchedules(request, scheduleId, [
    'routes',
    routeId,
    'stops',
    sequence,
  ]);
}

export async function DELETE(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ scheduleId: string; routeId: string; sequence: string }> },
) {
  const { scheduleId, routeId, sequence } = await params;
  return handleAdminSchedules(request, scheduleId, [
    'routes',
    routeId,
    'stops',
    sequence,
  ]);
}
