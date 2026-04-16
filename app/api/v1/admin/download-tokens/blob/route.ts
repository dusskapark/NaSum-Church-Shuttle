import { NextRequest, NextResponse } from 'next/server';
import { createDownloadBlobToken } from '@/server/download-blob-token-store';
import { error, json, requireActor } from '@/server/http';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const actor = await requireActor(request, 'admin');
  if (actor instanceof NextResponse) return actor;

  const body = (await request.json()) as {
    data?: string;
    mimeType?: string;
    filename?: string;
  };

  if (!body.data || !body.mimeType || !body.filename) {
    return error(400, 'data, mimeType, filename are required');
  }

  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(Buffer.from(body.data, 'base64'));
  } catch {
    return error(400, 'Invalid base64 data');
  }

  if (bytes.length === 0) return error(400, 'Empty file data');
  if (bytes.length > 10 * 1024 * 1024) {
    return error(413, 'File too large (max 10MB)');
  }

  const { token, expiresAt } = await createDownloadBlobToken({
    data: bytes,
    mimeType: body.mimeType,
    filename: body.filename,
  });

  return json({
    filename: body.filename,
    downloadUrl: `/api/v1/downloads/${token}`,
    expiresAt: expiresAt.toISOString(),
  });
}

