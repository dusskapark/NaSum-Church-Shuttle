import { NextRequest } from 'next/server';
import { handleAdminRuns } from '../../../_runs';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  return handleAdminRuns(request, runId, ['results']);
}
