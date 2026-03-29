import prisma from '../../../lib/prisma'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { provider = 'line', provider_uid } = req.query
    if (!provider_uid) return res.status(400).json({ error: 'provider_uid required' })

    const identity = await prisma.userIdentity.findUnique({
      where: { provider_provider_uid: { provider, provider_uid } },
      include: {
        user: {
          include: {
            registrations: {
              where: { status: 'active' },
              include: {
                route: { include: { stations: { orderBy: { sequence: 'asc' } } } },
                station: true,
              },
            },
          },
        },
      },
    })

    if (!identity) return res.status(200).json({ registered: false })

    const registration = identity.user.registrations[0] ?? null
    return res.status(200).json({
      registered: !!registration,
      user: { id: identity.user.id, display_name: identity.user.display_name },
      registration,
    })
  }

  if (req.method === 'POST') {
    const { provider = 'line', provider_uid, display_name, picture_url, route_id, station_id } = req.body
    if (!provider_uid || !route_id || !station_id) {
      return res.status(400).json({ error: 'provider_uid, route_id, station_id required' })
    }

    // Upsert user via identity
    let identity = await prisma.userIdentity.findUnique({
      where: { provider_provider_uid: { provider, provider_uid } },
      include: { user: true },
    })

    let userId
    if (!identity) {
      const user = await prisma.user.create({
        data: {
          display_name,
          picture_url,
          identities: { create: { provider, provider_uid } },
        },
      })
      userId = user.id
    } else {
      userId = identity.user_id
    }

    // Upsert registration (one active per user per route)
    const registration = await prisma.userRegistration.upsert({
      where: { user_id_route_id: { user_id: userId, route_id } },
      update: { station_id, status: 'active' },
      create: { user_id: userId, route_id, station_id },
      include: {
        route: { include: { stations: { orderBy: { sequence: 'asc' } } } },
        station: true,
      },
    })

    return res.status(200).json({ registered: true, registration })
  }

  res.status(405).end()
}
