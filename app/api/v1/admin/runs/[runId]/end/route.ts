import { NextRequest } from 'next/server';
import { handleAdminRuns } from '../../../_handlers';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  return handleAdminRuns(request, runId, ['end']);
}
