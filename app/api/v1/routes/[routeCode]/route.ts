import { NextRequest } from 'next/server';
import { error, json } from '@/server/http';
import { fetchRouteDetailByCode } from '@/server/routes-data';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ routeCode: string }> },
) {
  const { routeCode } = await context.params;
  const route = await fetchRouteDetailByCode(routeCode);
  if (!route) return error(404, 'Route not found');
  return json(route);
}
