import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/server/db';
import { error, json, requireActor } from '@/server/http';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const actor = await requireActor(request, 'admin');
  if (actor instanceof NextResponse) return actor;

  const status = request.nextUrl.searchParams.get('status') ?? 'active';
  if (!['active', 'inactive', 'all'].includes(status)) {
    return error(400, "status must be 'active', 'inactive', or 'all'");
  }

  const whereClause = status === 'all' ? '' : `WHERE ur.status = '${status}'`;
  const rows = await query(
    `SELECT
       ur.id AS registration_id,
       u.id AS user_id,
       u.display_name,
       u.picture_url,
       r.route_code,
       r.name AS route_name,
       r.display_name AS route_display_name,
       rs.id AS route_stop_id,
       rs.sequence,
       rs.pickup_time,
       p.name AS place_name,
       p.display_name AS place_display_name,
       ur.status,
       ur.registered_at,
       ur.updated_at
     FROM user_registrations ur
     JOIN users u ON u.id = ur.user_id
     JOIN routes r ON r.id = ur.route_id
     JOIN route_stops rs ON rs.id = ur.route_stop_id
     JOIN places p ON p.id = rs.place_id
     ${whereClause}
     ORDER BY ur.registered_at DESC NULLS LAST`,
  );

  return json(rows);
}
