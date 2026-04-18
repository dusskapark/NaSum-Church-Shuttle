import { NextRequest } from 'next/server';
import { handleAdminRoutes } from '../_routes';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handleAdminRoutes(request);
}
