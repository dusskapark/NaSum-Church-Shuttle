import { NextRequest, NextResponse } from 'next/server';
import { consumeDownloadBlobToken } from '@/server/download-blob-token-store';
import { error } from '@/server/http';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  if (request.method !== 'GET') return error(405, 'Method not allowed');

  const { token } = await params;
  if (!token) return error(404, 'Not found');

  const entry = await consumeDownloadBlobToken(token);
  if (!entry) return error(404, 'Download token expired or not found');

  const headers = new Headers();
  headers.set('Content-Type', entry.mimeType);
  headers.set(
    'Content-Disposition',
    `attachment; filename*=UTF-8''${encodeURIComponent(entry.filename)}`,
  );
  headers.set('Cache-Control', 'no-store');

  const arrayBuffer = entry.data.buffer.slice(
    entry.data.byteOffset,
    entry.data.byteOffset + entry.data.byteLength,
  ) as ArrayBuffer;

  return new NextResponse(new Blob([arrayBuffer]), { status: 200, headers });
}

