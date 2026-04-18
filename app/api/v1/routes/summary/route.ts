import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { json } from '@/server/http';
import { fetchRouteSummaries } from '@/server/routes-data';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const summaries = await fetchRouteSummaries();
  const payload = summaries.map((route) => ({
    ...route,
    visible_stop_count: Number(route.visible_stop_count ?? 0),
  }));

  const serialized = JSON.stringify(payload);
  const etag = `W/"${createHash('sha1').update(serialized).digest('hex')}"`;
  if (request.headers.get('if-none-match') === etag) {
    return new NextResponse(null, { status: 304 });
  }

  const response = json(payload);
  response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=600');
  response.headers.set('ETag', etag);
  return response;
}
