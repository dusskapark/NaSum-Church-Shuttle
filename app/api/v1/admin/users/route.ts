import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/server/db';
import { error, json, requireActor } from '@/server/http';

export const dynamic = 'force-dynamic';

type CoreRole = 'rider' | 'driver' | 'admin';

interface AdminUserRow {
  user_id: string;
  display_name: string | null;
  picture_url: string | null;
  role: CoreRole;
  provider: string;
  provider_uid: string;
}

export async function GET(request: NextRequest) {
  const actor = await requireActor(request, 'admin');
  if (actor instanceof NextResponse) return actor;

  const rows = await query<AdminUserRow>(
    `SELECT u.id AS user_id, u.display_name, u.picture_url, u.role,
            ui.provider, ui.provider_uid
     FROM users u
     JOIN user_identities ui ON ui.user_id = u.id
     WHERE u.role IN ('admin', 'driver')
     ORDER BY u.role, u.display_name`,
  );
  return json(rows);
}

export async function POST(request: NextRequest) {
  const actor = await requireActor(request, 'admin');
  if (actor instanceof NextResponse) return actor;

  const body = (await request.json()) as {
    provider_uid?: string;
    provider?: string;
    role?: CoreRole;
  };
  if (!body.provider_uid || !body.role) {
    return error(400, 'provider_uid and role are required');
  }
  if (!['admin', 'driver'].includes(body.role)) {
    return error(400, "role must be 'admin' or 'driver'");
  }

  const identity = await queryOne<{ user_id: string }>(
    `SELECT user_id FROM user_identities WHERE provider = $1 AND provider_uid = $2`,
    [body.provider ?? 'line', body.provider_uid],
  );
  if (!identity) {
    return error(404, 'User not found. They must log in at least once.');
  }
  await query(`UPDATE users SET role = $1 WHERE id = $2`, [
    body.role,
    identity.user_id,
  ]);
  const updated = await queryOne<AdminUserRow>(
    `SELECT u.id AS user_id, u.display_name, u.picture_url, u.role,
            ui.provider, ui.provider_uid
     FROM users u
     JOIN user_identities ui ON ui.user_id = u.id
     WHERE u.id = $1`,
    [identity.user_id],
  );
  return json(updated);
}
