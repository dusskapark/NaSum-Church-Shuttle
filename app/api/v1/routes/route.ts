import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { json } from '@/server/http';
import { fetchAllRouteDetails } from '@/server/routes-data';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const payload = await fetchAllRouteDetails();
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
