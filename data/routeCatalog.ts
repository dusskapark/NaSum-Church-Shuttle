export interface RouteCatalogEntry {
  name: string
  routeCode: string
  revision: string
  direction: string
  googleMapsUrl: string
}

const REVISION = '260224'

export const ROUTE_CATALOG: RouteCatalogEntry[] = [
  {
    name: 'SOUTH LINE (A)',
    routeCode: `south-a-${REVISION}`,
    revision: REVISION,
    direction: 'to_church',
    googleMapsUrl: 'https://maps.app.goo.gl/bqMqVvihihexcXVJ6',
  },
  {
    name: 'SOUTH LINE (B)',
    routeCode: `south-b-${REVISION}`,
    revision: REVISION,
    direction: 'to_church',
    googleMapsUrl: 'https://maps.app.goo.gl/uHN7L2NhP3QyRoRT6',
  },
  {
    name: 'NORTH CENTRE LINE (A)',
    routeCode: `north-centre-a-${REVISION}`,
    revision: REVISION,
    direction: 'to_church',
    googleMapsUrl: 'https://maps.app.goo.gl/w32HznqwpAcJrEof7',
  },
  {
    name: 'NORTH CENTRE LINE (B)',
    routeCode: `north-centre-b-${REVISION}`,
    revision: REVISION,
    direction: 'to_church',
    googleMapsUrl: 'https://maps.app.goo.gl/xBkpi4qSYd4PsDdq9',
  },
  {
    name: 'WEST LINE (A)',
    routeCode: `west-a-${REVISION}`,
    revision: REVISION,
    direction: 'to_church',
    googleMapsUrl: 'https://maps.app.goo.gl/KyRSqxfvyN4bYDFM9',
  },
  {
    name: 'WEST LINE (B)',
    routeCode: `west-b-${REVISION}`,
    revision: REVISION,
    direction: 'to_church',
    googleMapsUrl: 'https://maps.app.goo.gl/nNp4x38jEjPTDStJ6',
  },
  {
    name: 'EAST LINE (A)',
    routeCode: `east-a-${REVISION}`,
    revision: REVISION,
    direction: 'to_church',
    googleMapsUrl: 'https://maps.app.goo.gl/GEsYdyHhL9i1F3HD9',
  },
  {
    name: 'EAST LINE (B)',
    routeCode: `east-b-${REVISION}`,
    revision: REVISION,
    direction: 'to_church',
    googleMapsUrl: 'https://maps.app.goo.gl/uLe9ZmEnq4GP5w4k9',
  },
  {
    name: 'WEST COAST LINE (A)',
    routeCode: `west-coast-a-${REVISION}`,
    revision: REVISION,
    direction: 'to_church',
    googleMapsUrl: 'https://maps.app.goo.gl/bVJKd9gr9xQzq5RM9',
  },
  {
    name: 'WEST COAST LINE (B)',
    routeCode: `west-coast-b-${REVISION}`,
    revision: REVISION,
    direction: 'to_church',
    googleMapsUrl: 'https://maps.app.goo.gl/Jmvusj3Ut3MoV85e8',
  },
  {
    name: 'EAST COAST LINE (B)',
    routeCode: `east-coast-b-${REVISION}`,
    revision: REVISION,
    direction: 'to_church',
    googleMapsUrl: 'https://maps.app.goo.gl/hASr34KoUJfJBp6Q9',
  },
]
