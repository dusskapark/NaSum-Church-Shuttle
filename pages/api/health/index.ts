import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../lib/prisma'
import { logError } from '../../../lib/logger'

interface HealthResponse {
  status: 'ok' | 'error'
  database: 'connected' | 'disconnected'
  timestamp?: string
  error?: string
}

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse<HealthResponse>
): Promise<void> {
  try {
    await prisma.$queryRaw`SELECT 1`

    res.status(200).json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
    })
  } catch (caughtError) {
    const errorMessage = caughtError instanceof Error ? caughtError.message : 'Unknown error'
    logError('DB connection error:', caughtError)
    res.status(500).json({
      status: 'error',
      database: 'disconnected',
      error: errorMessage,
    })
  }
}
