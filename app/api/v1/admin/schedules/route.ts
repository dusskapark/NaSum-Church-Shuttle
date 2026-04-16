import { NextRequest } from 'next/server';
import { handleAdminSchedules } from '../_handlers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handleAdminSchedules(request);
}

export async function POST(request: NextRequest) {
  return handleAdminSchedules(request);
}
