import { NextResponse } from 'next/server';
import { query } from '@/server/db';
import { logError } from '@/lib/logger';

interface HealthResponse {
  status: 'ok' | 'error';
  database: 'connected' | 'disconnected';
  timestamp?: string;
  error?: string;
}

export async function GET() {
  try {
    await query('SELECT 1');

    const payload: HealthResponse = {
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
    };
    return NextResponse.json(payload, { status: 200 });
  } catch (caughtError) {
    const errorMessage =
      caughtError instanceof Error ? caughtError.message : 'Unknown error';
    logError('DB connection error:', caughtError);

    const payload: HealthResponse = {
      status: 'error',
      database: 'disconnected',
      error: errorMessage,
    };
    return NextResponse.json(payload, { status: 500 });
  }
}
