import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../lib/prisma'
import { withPrismaRetry } from '../../../lib/prismaRetry'
import type {
  RegisteredUserResponse,
  RegistrationWithRelations,
  UserRegistrationRequest,
} from '../../../lib/types'

type RegistrationApiResponse = RegisteredUserResponse | { error: string }

interface RegistrationQuery {
  provider?: string
  provider_uid?: string | string[]
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RegistrationApiResponse>
): Promise<void> {
  if (req.method === 'GET') {
    const { provider = 'line', provider_uid } = req.query as RegistrationQuery
    if (!provider_uid || Array.isArray(provider_uid)) {
      res.status(400).json({ error: 'provider_uid required' })
      return
    }

    const identity = await withPrismaRetry(() =>
      prisma.userIdentity.findUnique({
      where: { provider_provider_uid: { provider, provider_uid } },
      include: {
        user: {
          include: {
            registrations: {
              where: { status: 'active' },
              include: {
                route: {
                  include: {
                    stops: {
                      orderBy: { sequence: 'asc' },
                      include: {
                        place: true,
                      },
                    },
                  },
                },
                route_stop: {
                  include: {
                    place: true,
                  },
                },
              },
            },
          },
        },
      },
      })
    )

    if (!identity) {
      res.status(200).json({ registered: false })
      return
    }

    const registration = (identity.user.registrations[0] ?? null) as RegistrationWithRelations | null
    res.status(200).json({
      registered: Boolean(registration),
      user: { id: identity.user.id, display_name: identity.user.display_name },
      registration,
    })
    return
  }

  if (req.method === 'POST') {
    const {
      provider = 'line',
      provider_uid,
      display_name,
      picture_url,
      route_code,
      route_stop_id,
    } = req.body as UserRegistrationRequest

    if (!provider_uid || !route_code || !route_stop_id) {
      res.status(400).json({ error: 'provider_uid, route_code, route_stop_id required' })
      return
    }

    const identity = await withPrismaRetry(() =>
      prisma.userIdentity.findUnique({
      where: { provider_provider_uid: { provider, provider_uid } },
      include: { user: true },
      })
    )

    let userId: string
    if (!identity) {
      const user = await withPrismaRetry(() =>
        prisma.user.create({
        data: {
          display_name,
          picture_url,
          identities: { create: { provider, provider_uid } },
        },
        })
      )
      userId = user.id
    } else {
      userId = identity.user_id
    }

    const route = await withPrismaRetry(() =>
      prisma.route.findUnique({
      where: { route_code },
      })
    )

    if (!route) {
      res.status(404).json({ error: 'Route not found' })
      return
    }

    const routeStop = await withPrismaRetry(() =>
      prisma.routeStop.findUnique({
      where: { id: route_stop_id },
      include: {
        place: true,
      },
      })
    )

    if (!routeStop || routeStop.route_id !== route.id) {
      res.status(400).json({ error: 'route_stop_id does not belong to route_code' })
      return
    }

    const registration = (await withPrismaRetry(() =>
      prisma.userRegistration.upsert({
      where: { user_id_route_id: { user_id: userId, route_id: route.id } },
      update: { route_stop_id, status: 'active' },
      create: { user_id: userId, route_id: route.id, route_stop_id },
      include: {
        route: {
          include: {
            stops: {
              orderBy: { sequence: 'asc' },
              include: {
                place: true,
              },
            },
          },
        },
        route_stop: {
          include: {
            place: true,
          },
        },
      },
      })
    )) as RegistrationWithRelations

    res.status(200).json({ registered: true, registration })
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}
