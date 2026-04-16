import { Prisma, PrismaClient } from '@prisma/client'
import { PrismaNeonHttp } from '@prisma/adapter-neon'
import { ROUTE_CATALOG } from '../data/routeCatalog'
import { parseRouteLabel, syncRouteFromGoogleMapsUrl } from './support/googleRouteSync'

const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL
const googleMapsApiKey =
  process.env.GOOGLE_SERVER_MAPS_API_KEY ||
  process.env.GOOGLE_MAPS_API_KEY ||
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

if (!databaseUrl) {
  throw new Error('DIRECT_URL or DATABASE_URL is required to run prisma/seed.ts')
}

if (!googleMapsApiKey) {
  throw new Error('GOOGLE_MAPS_API_KEY or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is required to run prisma/seed.ts')
}

const prisma = new PrismaClient({
  adapter: new PrismaNeonHttp(databaseUrl.replace('channel_binding=require', 'channel_binding=disable'), {}),
})

async function resetRouteData(): Promise<void> {
  await prisma.scanEvent.deleteMany()
  await prisma.userRegistration.deleteMany()
  await prisma.shuttleRun.deleteMany()
  await prisma.routeStop.deleteMany()
  await prisma.route.deleteMany()
  await prisma.place.deleteMany()
}

async function upsertPlace(stop: {
  googlePlaceId: string
  name: string
  address: string
  lat: number
  lng: number
  placeTypes: string[]
  notes: string | null
  isTerminal: boolean
}): Promise<string> {
  const place = await prisma.place.upsert({
    where: { google_place_id: stop.googlePlaceId },
    update: {
      name: stop.name,
      display_name: null,
      address: stop.address,
      lat: stop.lat,
      lng: stop.lng,
      place_types: stop.placeTypes,
      notes: stop.notes,
      is_terminal: stop.isTerminal,
    },
    create: {
      google_place_id: stop.googlePlaceId,
      name: stop.name,
      display_name: null,
      address: stop.address,
      lat: stop.lat,
      lng: stop.lng,
      place_types: stop.placeTypes,
      notes: stop.notes,
      is_terminal: stop.isTerminal,
    },
  })

  return place.id
}

async function seedRoutes(): Promise<void> {
  const confirmedGoogleMapsApiKey = googleMapsApiKey as string

  for (const routeEntry of ROUTE_CATALOG) {
    const labels = parseRouteLabel(routeEntry.name)
    try {
      const syncedRoute = await syncRouteFromGoogleMapsUrl(routeEntry.googleMapsUrl, confirmedGoogleMapsApiKey)

      const route = await prisma.route.create({
        data: {
          route_code: routeEntry.routeCode,
          name: routeEntry.name,
          display_name: null,
          line: labels.line,
          service: labels.service,
          direction: routeEntry.direction,
          revision: routeEntry.revision,
          google_maps_url: routeEntry.googleMapsUrl,
          resolved_google_maps_url: syncedRoute.resolvedGoogleMapsUrl,
          sync_status: syncedRoute.syncStatus,
          sync_source_hash: syncedRoute.syncSourceHash,
          stops_snapshot_hash: syncedRoute.stopsSnapshotHash,
          last_synced_at: new Date(),
          sync_error: syncedRoute.syncError,
          path_json:
            (syncedRoute.pathSnapshot.pathJson as Prisma.InputJsonValue | null) ?? undefined,
          path_cache_status: syncedRoute.pathSnapshot.pathCacheStatus,
          path_cache_updated_at: syncedRoute.pathSnapshot.pathCacheUpdatedAt,
          path_cache_expires_at: syncedRoute.pathSnapshot.pathCacheExpiresAt,
          path_cache_error: syncedRoute.pathSnapshot.pathCacheError,
          active: true,
        },
      })

      for (const stop of syncedRoute.resolvedStops) {
        const placeId = await upsertPlace(stop)

        await prisma.routeStop.create({
          data: {
            route_id: route.id,
            place_id: placeId,
            sequence: stop.sequence,
            pickup_time: stop.pickupTime,
            notes: stop.notes,
            is_pickup_enabled: stop.isPickupEnabled,
          },
        })
      }

      console.log(
        `  ✓ ${routeEntry.name} — ${syncedRoute.resolvedStops.length} stops (${syncedRoute.pathSnapshot.pathCacheStatus})`
      )
    } catch (error) {
      await prisma.route.create({
        data: {
          route_code: routeEntry.routeCode,
          name: routeEntry.name,
          display_name: null,
          line: labels.line,
          service: labels.service,
          direction: routeEntry.direction,
          revision: routeEntry.revision,
          google_maps_url: routeEntry.googleMapsUrl,
          resolved_google_maps_url: null,
          sync_status: 'error',
          sync_source_hash: null,
          stops_snapshot_hash: null,
          last_synced_at: null,
          sync_error: error instanceof Error ? error.message : String(error),
          path_json: undefined,
          path_cache_status: 'missing',
          path_cache_updated_at: null,
          path_cache_expires_at: null,
          path_cache_error: error instanceof Error ? error.message : String(error),
          active: true,
        },
      })

      console.log(`  ✗ ${routeEntry.name} — sync failed`)
    }
  }
}

async function main(): Promise<void> {
  console.log('Resetting route-scoped shuttle data...')
  await resetRouteData()

  console.log('Syncing routes from Google Maps...')
  await seedRoutes()

  console.log('Seed complete.')
}

void main()
  .catch((error: unknown) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => prisma.$disconnect())
