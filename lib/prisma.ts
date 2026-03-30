import { PrismaClient } from '@prisma/client'
import { PrismaNeonHttp } from '@prisma/adapter-neon'

declare global {
  var prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DIRECT_URL or DATABASE_URL is required to initialize Prisma')
  }

  // Neon HTTP works more reliably here against the direct endpoint than the pooled URL.
const normalizedUrl = databaseUrl.replace('channel_binding=require', 'channel_binding=disable')
  const adapter = new PrismaNeonHttp(normalizedUrl, {})
  return new PrismaClient({ adapter })
}

const prisma =
  process.env.NODE_ENV === 'production'
    ? globalThis.prisma ?? createPrismaClient()
    : createPrismaClient()

if (process.env.NODE_ENV === 'production') {
  globalThis.prisma = prisma
}

export default prisma
