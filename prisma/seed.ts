import { PrismaClient } from '@prisma/client'
import { PrismaNeonHttp } from '@prisma/adapter-neon'

interface SeedStation {
  seq: number
  name: string
  bus_stop_id?: string
  lat: number
  lng: number
  pickup_time?: string
  notes?: string
  is_terminal?: boolean
}

interface SeedRoute {
  line: string
  service: string
  google_maps_url?: string
  stations: SeedStation[]
}

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run prisma/seed.ts')
}

const prisma = new PrismaClient({
  adapter: new PrismaNeonHttp(databaseUrl, {}),
})

const TERMINAL: Omit<SeedStation, 'seq' | 'pickup_time' | 'notes'> = {
  name: "S'Pore Bible Coll Bus Stop B41121",
  bus_stop_id: 'B41121',
  lat: 1.3197,
  lng: 103.8072,
  is_terminal: true,
}

const ROUTES: SeedRoute[] = [
  {
    line: 'SOUTH',
    service: 'A',
    google_maps_url: 'https://maps.app.goo.gl/bqMqVvihihexcXVJ6',
    stations: [
      { seq: 1, name: 'Opp Great World City', bus_stop_id: '13121', lat: 1.2939, lng: 103.8356, pickup_time: '09:05' },
      { seq: 2, name: 'Opp Newton Life Ch', bus_stop_id: '40121', lat: 1.3175, lng: 103.8388, pickup_time: '09:14' },
      { seq: 3, name: 'Botanic Gdns F65 Taxi Stand', lat: 1.3247, lng: 103.8156, pickup_time: '09:23', notes: '1분정차' },
      { seq: 4, ...TERMINAL, pickup_time: '09:25' },
    ],
  },
  {
    line: 'SOUTH',
    service: 'B',
    google_maps_url: 'https://maps.app.goo.gl/uHN7L2NhP3QyRoRT6',
    stations: [
      { seq: 1, name: 'Opp Great World City', bus_stop_id: '13121', lat: 1.2939, lng: 103.8356, pickup_time: '11:00' },
      { seq: 2, name: 'Opp Newton Life Ch', bus_stop_id: '40121', lat: 1.3175, lng: 103.8388, pickup_time: '11:08' },
      { seq: 3, name: 'Opp Hotel Royal', bus_stop_id: '50061', lat: 1.3208, lng: 103.8483, pickup_time: '11:10' },
      { seq: 4, name: 'Botanic Gdns F65 Taxi Stand', lat: 1.3247, lng: 103.8156, pickup_time: '11:18', notes: '1분정차' },
      { seq: 5, ...TERMINAL, pickup_time: '11:20' },
    ],
  },
  {
    line: 'NORTH CENTRE',
    service: 'A',
    google_maps_url: 'https://maps.app.goo.gl/w32HznqwpAcJrEof7',
    stations: [
      { seq: 1, name: 'Amber Gdns', bus_stop_id: '92241', lat: 1.3036, lng: 103.9071, pickup_time: '08:45' },
      { seq: 2, name: "Opp S'Goon Stn Exit F", bus_stop_id: '66381', lat: 1.3512, lng: 103.8730, pickup_time: '09:03' },
      { seq: 3, ...TERMINAL, pickup_time: '09:20' },
    ],
  },
  {
    line: 'NORTH CENTRE',
    service: 'B',
    google_maps_url: 'https://maps.app.goo.gl/xBkpi4qSYd4PsDdq9',
    stations: [
      { seq: 1, name: 'Opp Blk 447A', bus_stop_id: '64401', lat: 1.3718, lng: 103.8766, pickup_time: '10:30' },
      { seq: 2, name: 'Buangkok Stn Exit B', bus_stop_id: 'B67601', lat: 1.3836, lng: 103.8839, pickup_time: '10:37' },
      { seq: 3, name: 'Lorong Chuan MRT G08 Taxi Stand', lat: 1.3504, lng: 103.8645, pickup_time: '10:54' },
      { seq: 4, name: "S'Goon Stn Exit F", bus_stop_id: '66389', lat: 1.3509, lng: 103.8729, pickup_time: '10:58' },
      { seq: 5, ...TERMINAL, pickup_time: '11:20' },
    ],
  },
  {
    line: 'WEST',
    service: 'A',
    google_maps_url: 'https://maps.app.goo.gl/KyRSqxfvyN4bYDFM9',
    stations: [
      { seq: 1, name: 'Nanyang Meadows', lat: 1.344, lng: 103.6879, pickup_time: '08:30' },
      { seq: 2, name: 'Choa Chu Kang Loop (PUDO)', lat: 1.3863, lng: 103.7449, pickup_time: '08:43' },
      { seq: 3, name: 'Bt Panjang Stn Exit A/LRT', bus_stop_id: '44029', lat: 1.3784, lng: 103.7636, pickup_time: '08:52' },
      { seq: 4, name: 'Assumption Pathway School Bus', bus_stop_id: '43099', lat: 1.3592, lng: 103.7706, pickup_time: '08:55' },
      { seq: 5, name: 'Hillview Hts', bus_stop_id: '43267', lat: 1.3634, lng: 103.7673, pickup_time: '09:01' },
      { seq: 6, name: 'Bef Summerhill', bus_stop_id: '43811', lat: 1.3477, lng: 103.7813, pickup_time: '09:03' },
      { seq: 7, name: 'Opp Symphony Hts', bus_stop_id: '43821', lat: 1.347, lng: 103.7831, pickup_time: '09:07' },
      { seq: 8, name: 'Opp Tan Kah Kee Stn', bus_stop_id: '41069', lat: 1.3317, lng: 103.8076, pickup_time: '09:12' },
      { seq: 9, ...TERMINAL, pickup_time: '09:20' },
    ],
  },
  {
    line: 'WEST',
    service: 'B',
    google_maps_url: 'https://maps.app.goo.gl/nNp4x38jEjPTDStJ6',
    stations: [
      { seq: 1, name: 'Nanyang Meadows', lat: 1.344, lng: 103.6879, pickup_time: '10:42' },
      { seq: 2, name: 'Bt Panjang Stn Exit A/LRT', bus_stop_id: '44029', lat: 1.3784, lng: 103.7636, pickup_time: '10:55' },
      { seq: 3, name: 'Hillview Hts', bus_stop_id: '43267', lat: 1.3634, lng: 103.7673, pickup_time: '11:00' },
      { seq: 4, name: 'Bef Summerhill', bus_stop_id: '43811', lat: 1.3477, lng: 103.7813, pickup_time: '11:01' },
      { seq: 5, name: 'Opp Symphony Hts', bus_stop_id: '43821', lat: 1.347, lng: 103.7831, pickup_time: '11:02' },
      { seq: 6, name: 'Opp Tan Kah Kee Stn', bus_stop_id: '41069', lat: 1.3317, lng: 103.8076, pickup_time: '11:13' },
      { seq: 7, ...TERMINAL, pickup_time: '11:16' },
    ],
  },
  {
    line: 'EAST',
    service: 'A',
    google_maps_url: 'https://maps.app.goo.gl/GEsYdyHhL9i1F3HD9',
    stations: [
      { seq: 1, name: 'Eden Condo', bus_stop_id: '76461', lat: 1.3706, lng: 103.9493, pickup_time: '08:15' },
      { seq: 2, name: 'The Santorini', bus_stop_id: '75409', lat: 1.3562, lng: 103.9378, pickup_time: '08:27' },
      { seq: 3, name: 'Opp Waterfront Key', bus_stop_id: '64601', lat: 1.372, lng: 103.8766, pickup_time: '08:34' },
      { seq: 4, name: 'Opp Clearwater Condo', bus_stop_id: '75341', lat: 1.3561, lng: 103.9333, pickup_time: '08:35' },
      { seq: 5, name: 'Opp Blk 3012', bus_stop_id: '96109', lat: 1.3423, lng: 103.9601, pickup_time: '08:44' },
      { seq: 6, name: 'KINEX Blk 14 Mkt/FC Geylang Rd', bus_stop_id: '82029', lat: 1.314, lng: 103.8892, pickup_time: '09:03' },
      { seq: 7, ...TERMINAL, pickup_time: '09:20' },
    ],
  },
  {
    line: 'EAST',
    service: 'B',
    google_maps_url: 'https://maps.app.goo.gl/uLe9ZmEnq4GP5w4k9',
    stations: [
      { seq: 1, name: 'Opp Pasir Ris Elias CC', bus_stop_id: '77209', lat: 1.3762, lng: 103.9407, pickup_time: '10:28' },
      { seq: 2, name: 'East Springs Sec Sch', bus_stop_id: '76469', lat: 1.3694, lng: 103.9504, pickup_time: '10:36' },
      { seq: 3, name: 'Opp Simei Stn', bus_stop_id: '96161', lat: 1.3416, lng: 103.9539, pickup_time: '10:45' },
      { seq: 4, name: 'Bef Changi General Hospital', bus_stop_id: '96251', lat: 1.3419, lng: 103.9595, pickup_time: '10:48' },
      { seq: 5, name: 'The Santorini', bus_stop_id: '75409', lat: 1.3562, lng: 103.9378, pickup_time: '10:58' },
      { seq: 6, ...TERMINAL, pickup_time: '11:16' },
    ],
  },
  {
    line: 'WEST COAST',
    service: 'A',
    google_maps_url: 'https://maps.app.goo.gl/bVJKd9gr9xQzq5RM9',
    stations: [
      { seq: 1, name: 'The Japanese Pr Sch', bus_stop_id: '16151', lat: 1.3119, lng: 103.7897, pickup_time: '09:04' },
      { seq: 2, name: 'Buona Vista (Blk 27)', bus_stop_id: '19019', lat: 1.3067, lng: 103.7896, pickup_time: '09:11' },
      { seq: 3, ...TERMINAL, pickup_time: '09:20' },
    ],
  },
  {
    line: 'WEST COAST',
    service: 'B',
    google_maps_url: 'https://maps.app.goo.gl/Jmvusj3Ut3MoV85e8',
    stations: [
      { seq: 1, name: 'Opp Kent Ridge Ter', bus_stop_id: '16131', lat: 1.3113, lng: 103.7876, pickup_time: '10:56' },
      { seq: 2, name: 'The Japanese Pr Sch', bus_stop_id: '16151', lat: 1.3119, lng: 103.7897, pickup_time: '10:58' },
      { seq: 3, name: 'Clementi Stn Exit B', bus_stop_id: '17179', lat: 1.315, lng: 103.7649, pickup_time: '11:05' },
      { seq: 4, name: 'Buona Vista (Blk 27)', bus_stop_id: '19019', lat: 1.3067, lng: 103.7896, pickup_time: '11:11' },
      { seq: 5, ...TERMINAL, pickup_time: '11:21' },
    ],
  },
  {
    line: 'EAST COAST',
    service: 'B',
    google_maps_url: 'https://maps.app.goo.gl/hASr34KoUJfJBp6Q9',
    stations: [
      { seq: 1, name: 'St Patrick School', bus_stop_id: '92159', lat: 1.3079, lng: 103.9064, pickup_time: '10:43' },
      { seq: 2, name: 'Amber Gdns', bus_stop_id: '92241', lat: 1.3036, lng: 103.9071, pickup_time: '10:50' },
      { seq: 3, name: 'Dakota Stn Exit B Taxi Stand', lat: 1.3073, lng: 103.8842, pickup_time: '10:56' },
      { seq: 4, ...TERMINAL, pickup_time: '11:20' },
    ],
  },
]

async function main(): Promise<void> {
  const routeCount = await prisma.route.count()
  if (routeCount > 0) {
    console.log(`Already seeded (${routeCount} routes). Skipping.`)
    return
  }

  console.log('Seeding routes and stations...')
  for (const { stations, ...routeFields } of ROUTES) {
    const route = await prisma.route.create({
      data: {
        ...routeFields,
        direction: 'to_church',
      },
    })

    for (const { seq, bus_stop_id, ...rest } of stations) {
      await prisma.station.create({
        data: {
          route_id: route.id,
          sequence: seq,
          bus_stop_id: bus_stop_id ?? null,
          ...rest,
        },
      })
    }

    console.log(`  ✓ ${route.line} LINE (${route.service}) — ${stations.length} stations`)
  }
  console.log('Seed complete.')
}

void main()
  .catch((error: unknown) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => prisma.$disconnect())
