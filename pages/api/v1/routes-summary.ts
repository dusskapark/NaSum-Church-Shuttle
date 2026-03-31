import type { NextApiRequest, NextApiResponse } from 'next'
import { logError } from '../../../lib/logger'
import prisma from '../../../lib/prisma'
import { withPrismaRetry } from '../../../lib/prismaRetry'

interface RouteSummary {
  id: string
  routeCode: string
  name: string
  displayName: string | null
  line: string
  service: string
  direction: string
  revision: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RouteSummary[] | { error: string }>
): Promise<void> {
  try {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    const routes = await withPrismaRetry(() =>
      prisma.route.findMany({
        where: { active: true },
        select: {
          id: true,
          route_code: true,
          name: true,
          display_name: true,
          line: true,
          service: true,
          direction: true,
          revision: true,
        },
        orderBy: [{ line: 'asc' }, { service: 'asc' }, { revision: 'asc' }],
      })
    )

    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600')
    res.status(200).json(
      routes.map(route => ({
        id: route.id,
        routeCode: route.route_code,
        name: route.name,
        displayName: route.display_name,
        line: route.line,
        service: route.service,
        direction: route.direction,
        revision: route.revision,
      }))
    )
  } catch (error) {
    logError('Failed to load route summary:', error)
    res.status(500).json({ error: 'Failed to load route summary' })
  }
}
