import { NextRequest } from 'next/server';
import { handleAdminPlaces } from '../../../_handlers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ googlePlaceId: string }> },
) {
  const { googlePlaceId } = await params;
  return handleAdminPlaces(request, ['lookup', googlePlaceId]);
}
