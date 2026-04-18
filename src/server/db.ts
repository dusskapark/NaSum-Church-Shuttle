import { Pool, type PoolClient } from '@neondatabase/serverless';
import { env } from './env';

function resolveConnectionString() {
  const connectionString =
    env.DATABASE_URL ?? env.NEON_DATABASE_URL ?? env.DIRECT_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL (or NEON_DATABASE_URL / DIRECT_URL) is required',
    );
  }
  return connectionString;
}

let pool: Pool | null = null;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: resolveConnectionString(),
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }

  return pool;
}

export async function query<T = unknown>(
  sql: string,
  params?: unknown[],
): Promise<T[]> {
  const client = await getPool().connect();
  try {
    const result = await client.query(sql, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

export async function queryOne<T = unknown>(
  sql: string,
  params?: unknown[],
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export default getPool;
