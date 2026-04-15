import { Pool, type PoolClient } from 'pg';
import { env } from './env';

function resolveConnectionString() {
  if (process.env.NODE_ENV !== 'production') {
    return (
      env.LOCAL_DATABASE_URL ??
      'postgres://shuttle:shuttle@127.0.0.1:5434/nasum_shuttle?sslmode=disable'
    );
  }
  return env.DATABASE_URL;
}

const pool = new Pool({
  connectionString: resolveConnectionString(),
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export async function query<T = unknown>(
  sql: string,
  params?: unknown[],
): Promise<T[]> {
  const client = await pool.connect();
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
  const client = await pool.connect();
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

export default pool;
