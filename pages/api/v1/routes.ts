import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../lib/prisma'
import type { RoutesResponse } from '../../../lib/types'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RoutesResponse | { error: string }>
): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const routes = await prisma.route.findMany({
    where: { active: true },
    include: {
      stations: {
        orderBy: { sequence: 'asc' },
      },
    },
    orderBy: [{ line: 'asc' }, { service: 'asc' }],
  })

  res.status(200).json(routes)
}
