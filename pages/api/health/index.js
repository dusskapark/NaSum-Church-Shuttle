import prisma from '../../../lib/prisma'

export default async function handler(req, res) {
  try {
    // 간단한 DB 연결 테스트
    await prisma.$queryRaw`SELECT 1`

    res.status(200).json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('DB 연결 오류:', error)
    res.status(500).json({
      status: 'error',
      database: 'disconnected',
      error: error.message
    })
  }
}
