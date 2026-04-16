import { NextRequest } from 'next/server';
import { handleAdminRoutes } from '../_handlers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handleAdminRoutes(request);
}
