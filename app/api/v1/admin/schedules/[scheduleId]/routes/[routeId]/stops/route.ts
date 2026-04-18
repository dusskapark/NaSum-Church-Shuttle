import { NextRequest } from 'next/server';
import { handleAdminSchedules } from '../../../../../_schedules';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ scheduleId: string; routeId: string }> },
) {
  const { scheduleId, routeId } = await params;
  return handleAdminSchedules(request, scheduleId, ['routes', routeId, 'stops']);
}
