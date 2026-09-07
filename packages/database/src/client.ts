import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Pool, type PoolClient, type PoolConfig, type QueryResultRow } from 'pg';

const localEnv = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(localEnv)) process.loadEnvFile(localEnv);

export const DEFAULT_DATABASE_URL =
  'postgresql://knowledge_map:knowledge_map_dev@localhost:5432/knowledge_map';

export type DatabaseClient = Pool | PoolClient;

export function createDatabasePool(overrides: PoolConfig = {}): Pool {
  return new Pool({
    connectionString: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
    max: Number.parseInt(process.env.DATABASE_POOL_MAX ?? '5', 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 3_000,
    ...overrides,
  });
}

export async function inTransaction<T>(pool: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function oneOrNull<T extends QueryResultRow>(
  client: DatabaseClient,
  query: string,
  values: readonly unknown[] = [],
): Promise<T | null> {
  const result = await client.query<T>(query, [...values]);
  return result.rows[0] ?? null;
}

export async function closeDatabasePool(pool: Pool): Promise<void> {
  await pool.end();
}

export type { Pool, PoolClient, QueryResult } from 'pg';
