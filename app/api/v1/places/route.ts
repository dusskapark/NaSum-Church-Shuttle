import { json } from '@/server/http';
import { fetchPlaceSummaries } from '@/server/routes-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  const places = await fetchPlaceSummaries();
  return json(places);
}
