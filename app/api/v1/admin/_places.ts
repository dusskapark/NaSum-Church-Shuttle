import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/server/db';
import { error, json, requireActor } from '@/server/http';
import { env } from '@/server/env';
import { getPlaceById } from '@/server/google-places';

interface PlaceLookupResponse {
  google_place_id: string;
  name: string;
  display_name: string | null;
  formatted_address: string | null;
  lat: number;
  lng: number;
  place_types: string[];
  is_terminal: boolean;
  stop_id: string | null;
}

async function upsertPlaceFromLookup(
  input: PlaceLookupResponse,
): Promise<PlaceLookupResponse & { id: string }> {
  const row = await queryOne<PlaceLookupResponse & { id: string }>(
    `INSERT INTO places
       (id, google_place_id, name, display_name, formatted_address, primary_type, primary_type_display_name, lat, lng, place_types, notes, is_terminal, stop_id)
     VALUES
       ($1, $2, $3, $4, $5, NULL, NULL, $6, $7, $8, NULL, $9, $10)
     ON CONFLICT (google_place_id)
     DO UPDATE SET
       name = EXCLUDED.name,
       display_name = COALESCE(places.display_name, EXCLUDED.display_name),
       formatted_address = EXCLUDED.formatted_address,
       lat = EXCLUDED.lat,
       lng = EXCLUDED.lng,
       place_types = EXCLUDED.place_types
     RETURNING id, google_place_id, name, display_name, formatted_address, lat, lng, place_types, is_terminal, stop_id`,
    [
      randomUUID(),
      input.google_place_id,
      input.name,
      input.display_name,
      input.formatted_address,
      input.lat,
      input.lng,
      input.place_types ?? [],
      input.is_terminal,
      input.stop_id,
    ],
  );

  if (!row) throw new Error('Failed to upsert place');
  return row;
}

export async function handleAdminPlaces(
  request: NextRequest,
  suffix?: string[],
) {
  const actor = await requireActor(request, 'admin');
  if (actor instanceof NextResponse) return actor;

  if (request.method === 'GET' && suffix?.[0] === 'lookup' && suffix?.[1]) {
    const googlePlaceId = decodeURIComponent(suffix[1]).trim();
    if (!googlePlaceId || !/^[-_a-zA-Z0-9]+$/.test(googlePlaceId)) {
      return error(400, 'invalid place id');
    }

    const existing = await queryOne<PlaceLookupResponse>(
      `SELECT google_place_id, name, display_name, formatted_address, lat, lng, place_types, is_terminal, stop_id
       FROM places
       WHERE google_place_id = $1`,
      [googlePlaceId],
    );
    if (existing) return json(existing);

    const apiKey = env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) return error(500, 'GOOGLE_MAPS_API_KEY not configured');

    try {
      const place = await getPlaceById(googlePlaceId, apiKey);
      if (!place) return error(404, 'place not found');

      const upserted = await upsertPlaceFromLookup({
        google_place_id: place.googlePlaceId,
        name: place.name,
        display_name: place.name || null,
        formatted_address: place.formattedAddress,
        lat: place.lat,
        lng: place.lng,
        place_types: place.types ?? [],
        is_terminal: false,
        stop_id: null,
      });

      return json({
        google_place_id: upserted.google_place_id,
        name: upserted.name,
        display_name: upserted.display_name,
        formatted_address: upserted.formatted_address,
        lat: Number(upserted.lat),
        lng: Number(upserted.lng),
        place_types: upserted.place_types ?? [],
        is_terminal: upserted.is_terminal,
        stop_id: upserted.stop_id,
      });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      return error(502, `google api error: ${message}`);
    }
  }

  return error(405, 'Method not allowed');
}
