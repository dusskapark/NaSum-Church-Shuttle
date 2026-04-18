import { NextRequest } from 'next/server';
import { error, json } from '@/server/http';
import { fetchPlaceRouteCandidates } from '@/server/routes-data';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ googlePlaceId: string }> },
) {
  const { googlePlaceId } = await context.params;
  let decodedGooglePlaceId = '';
  try {
    decodedGooglePlaceId = decodeURIComponent(googlePlaceId);
  } catch {
    return error(400, 'invalid place id');
  }
  const payload = await fetchPlaceRouteCandidates(decodedGooglePlaceId);
  return json(payload);
}
