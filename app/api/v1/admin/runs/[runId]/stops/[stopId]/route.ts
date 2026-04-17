import { NextRequest } from 'next/server';
import { handleAdminRuns } from '../../../../_runs';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string; stopId: string }> },
) {
  const { runId, stopId } = await params;
  return handleAdminRuns(request, runId, ['stops', stopId]);
}
