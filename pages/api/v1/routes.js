import prisma from '../../../lib/prisma'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

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
