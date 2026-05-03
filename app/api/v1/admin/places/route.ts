import { NextRequest } from 'next/server';
import { handleAdminPlaces } from '../_places';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handleAdminPlaces(request);
}
