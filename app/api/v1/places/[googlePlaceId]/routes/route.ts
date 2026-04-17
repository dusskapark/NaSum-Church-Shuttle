import { NextRequest } from 'next/server';
import { json } from '@/server/http';
import { fetchPlaceRouteCandidates } from '@/server/routes-data';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ googlePlaceId: string }> },
) {
  const { googlePlaceId } = await context.params;
  const payload = await fetchPlaceRouteCandidates(decodeURIComponent(googlePlaceId));
  return json(payload);
}
