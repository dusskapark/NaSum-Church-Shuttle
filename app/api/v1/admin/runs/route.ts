import { NextRequest } from 'next/server';
import { handleAdminRuns } from '../_handlers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handleAdminRuns(request);
}

export async function POST(request: NextRequest) {
  return handleAdminRuns(request);
}
