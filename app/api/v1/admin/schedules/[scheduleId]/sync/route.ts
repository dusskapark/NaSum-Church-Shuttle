import { NextRequest } from 'next/server';
import { handleAdminSchedules } from '../../../_schedules';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ scheduleId: string }> },
) {
  const { scheduleId } = await params;
  return handleAdminSchedules(request, scheduleId, ['sync']);
}
