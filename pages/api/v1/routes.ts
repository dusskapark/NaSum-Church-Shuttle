import { createHash } from 'node:crypto'
import type { NextApiRequest, NextApiResponse } from 'next'
import { logError } from '../../../lib/logger'
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

function createEtag(response: RoutesResponse): string {
  const payload = JSON.stringify(response)
  const hash = createHash('sha1').update(payload).digest('hex')
  return `W/\"${hash}\"`
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
            select: {
              id: true,
              route_id: true,
              place_id: true,
              sequence: true,
              pickup_time: true,
              notes: true,
              is_pickup_enabled: true,
              place: {
                select: {
                  id: true,
                  google_place_id: true,
                  name: true,
                  display_name: true,
                  address: true,
                  lat: true,
                  lng: true,
                  place_types: true,
                  notes: true,
                  is_terminal: true,
                },
              },
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
    })) as RoutesResponse

    const etag = createEtag(response)
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600')
    res.setHeader('ETag', etag)

    if (req.headers['if-none-match'] === etag) {
      res.status(304).end()
      return
    }

    res.status(200).json(response)
  } catch (error) {
    logError('Failed to load routes:', error)
    res.status(500).json({ error: 'Failed to load routes' })
  }
}
