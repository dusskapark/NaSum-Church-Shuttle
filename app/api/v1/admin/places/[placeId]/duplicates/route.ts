import { NextRequest } from 'next/server';
import { handleAdminPlaces } from '../../../_places';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ placeId: string }> },
) {
  const { placeId } = await params;
  return handleAdminPlaces(request, [placeId, 'duplicates']);
}
