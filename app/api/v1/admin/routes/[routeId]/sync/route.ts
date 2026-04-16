import { NextRequest } from 'next/server';
import { handleAdminRoutes } from '../../../_handlers';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ routeId: string }> },
) {
  const { routeId } = await params;
  return handleAdminRoutes(request, routeId, ['sync']);
}
