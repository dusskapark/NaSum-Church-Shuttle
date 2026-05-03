import { NextRequest } from 'next/server';
import { handleAdminRoutes } from '../../../../../_routes';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ routeId: string; stopId: string }> },
) {
  const { routeId, stopId } = await params;
  return handleAdminRoutes(request, routeId, ['stops', stopId, 'full']);
}
