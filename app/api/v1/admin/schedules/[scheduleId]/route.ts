import { NextRequest } from 'next/server';
import { handleAdminSchedules } from '../../_handlers';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ scheduleId: string }> },
) {
  const { scheduleId } = await params;
  return handleAdminSchedules(request, scheduleId);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ scheduleId: string }> },
) {
  const { scheduleId } = await params;
  return handleAdminSchedules(request, scheduleId);
}
