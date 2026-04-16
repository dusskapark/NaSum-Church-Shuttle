import { randomUUID } from 'node:crypto';
import { query, withTransaction } from './db';

const TOKEN_TTL_MS = 10 * 60 * 1000;

interface DownloadBlobRow {
  data: Buffer;
  mime_type: string;
  filename: string;
  expires_at: Date;
}

interface DownloadBlobRecord {
  data: Uint8Array;
  mimeType: string;
  filename: string;
  expiresAt: Date;
}

let ensureTablePromise: Promise<void> | null = null;

async function ensureTable() {
  if (!ensureTablePromise) {
    ensureTablePromise = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS admin_download_blob_tokens (
          token TEXT PRIMARY KEY,
          data BYTEA NOT NULL,
          mime_type TEXT NOT NULL,
          filename TEXT NOT NULL,
          expires_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await query(`
        CREATE INDEX IF NOT EXISTS idx_admin_download_blob_tokens_expires_at
          ON admin_download_blob_tokens (expires_at)
      `);
    })();
  }
  return ensureTablePromise;
}

export async function createDownloadBlobToken(input: {
  data: Uint8Array;
  mimeType: string;
  filename: string;
}) {
  await ensureTable();

  const token = randomUUID().replace(/-/g, '');
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await withTransaction(async (client) => {
    await client.query(
      `DELETE FROM admin_download_blob_tokens WHERE expires_at <= NOW()`,
    );
    await client.query(
      `INSERT INTO admin_download_blob_tokens
         (token, data, mime_type, filename, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [token, Buffer.from(input.data), input.mimeType, input.filename, expiresAt],
    );
  });

  return { token, expiresAt };
}

export async function consumeDownloadBlobToken(
  token: string,
): Promise<DownloadBlobRecord | null> {
  await ensureTable();

  const row = await withTransaction<DownloadBlobRow | null>(async (client) => {
    const result = await client.query<DownloadBlobRow>(
      `DELETE FROM admin_download_blob_tokens
       WHERE token = $1 AND expires_at > NOW()
       RETURNING data, mime_type, filename, expires_at`,
      [token],
    );
    if (result.rows[0]) return result.rows[0];

    await client.query(
      `DELETE FROM admin_download_blob_tokens WHERE token = $1`,
      [token],
    );
    return null;
  });

  if (!row) return null;

  return {
    data: new Uint8Array(row.data),
    mimeType: row.mime_type,
    filename: row.filename,
    expiresAt: row.expires_at,
  };
}

