import { NextResponse } from 'next/server';
import { env } from '@/server/env';

const DEFAULT_IOS_APP_ID = 'ZQC7QNZ4J8.sg.nasumchurch.shuttle';

function csv(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function GET() {
  const appIds = csv(env.IOS_UNIVERSAL_LINK_APP_IDS);
  const details = (appIds.length ? appIds : [DEFAULT_IOS_APP_ID]).map(
    (appID) => ({
      appID,
      paths: ['/scan', '/scan/*'],
    }),
  );

  return NextResponse.json(
    {
      applinks: {
        apps: [],
        details,
      },
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=3600',
        'Content-Type': 'application/json',
      },
    },
  );
}
