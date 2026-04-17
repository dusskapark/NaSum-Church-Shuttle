import { NextRequest } from 'next/server';
import { handleAdminSchedules } from '../../../../../../_handlers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ scheduleId: string; routeId: string }> },
) {
  const { scheduleId, routeId } = await params;
  return handleAdminSchedules(request, scheduleId, [
    'routes',
    routeId,
    'stops',
    'candidates',
  ]);
}
