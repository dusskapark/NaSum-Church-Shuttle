import { config } from 'dotenv'
import { defineConfig } from 'prisma/config'

config({ path: '.env.local', override: true })

// Prisma schema-engine does not support channel_binding=require
const rawUrl = process.env.DIRECT_URL || process.env.DATABASE_URL
const url = rawUrl?.replace('&channel_binding=require', '')

export default defineConfig({
  migrations: {
    seed: 'bun ./prisma/seed.ts',
  },
  datasource: {
    url: url as string,
  },
})
