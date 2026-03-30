import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../lib/prisma'
import { withPrismaRetry } from '../../../lib/prismaRetry'
import type { RoutePathPoint, RouteWithStops, RoutesResponse } from '../../../lib/types'

function isRoutePathPoint(value: unknown): value is RoutePathPoint {
  return (
    typeof value === 'object' &&
    value !== null &&
    'lat' in value &&
    'lng' in value &&
    typeof value.lat === 'number' &&
    typeof value.lng === 'number'
  )
}

function toCachedPath(value: unknown): RoutePathPoint[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter(isRoutePathPoint)
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RoutesResponse | { error: string }>
): Promise<void> {
  try {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    const routes = (await withPrismaRetry(() =>
      prisma.route.findMany({
      where: { active: true },
      include: {
        stops: {
          orderBy: { sequence: 'asc' },
          include: {
            place: true,
          },
        },
      },
      orderBy: [{ line: 'asc' }, { service: 'asc' }, { revision: 'asc' }],
      })
    )) as RouteWithStops[]

    const response = routes.map(route => ({
      ...route,
      cachedPath: toCachedPath(route.path_json),
      pathCacheStatus: route.path_cache_status ?? 'missing',
      pathCacheUpdatedAt: route.path_cache_updated_at?.toISOString() ?? null,
      pathCacheExpiresAt: route.path_cache_expires_at?.toISOString() ?? null,
      pathCacheError: route.path_cache_error ?? null,
    }))

    res.status(200).json(response as RoutesResponse)
  } catch (error) {
    console.error('Failed to load routes:', error)
    res.status(500).json({ error: 'Failed to load routes' })
  }
}
