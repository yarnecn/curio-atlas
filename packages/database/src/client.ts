import {
  createPool as createMysqlPool,
  type Pool as MysqlPool,
  type PoolConnection,
  type PoolOptions,
  type ResultSetHeader,
  type RowDataPacket,
} from 'mysql2/promise';

export const DEFAULT_DATABASE_URL =
  'mysql://knowledge_map:knowledge_map_dev@localhost:3306/knowledge_map';

export type QueryResultRow = object;

export interface QueryResult<T extends QueryResultRow = QueryResultRow> {
  rows: T[];
  rowCount: number;
}

export interface DatabaseClient {
  query<T extends QueryResultRow = QueryResultRow>(sql: string, values?: readonly unknown[]): Promise<QueryResult<T>>;
}

export interface PoolClient extends DatabaseClient {
  release(): void;
}

export interface Pool extends DatabaseClient {
  connect(): Promise<PoolClient>;
  end(): Promise<void>;
}

type ConnectionLike = MysqlPool | PoolConnection;

function compileQuery(sql: string, values: readonly unknown[]): { sql: string; values: unknown[] } {
  const orderedValues: unknown[] = [];
  const compiled = sql.replace(/\$(\d+)/g, (_match, index: string) => {
    orderedValues.push(values[Number(index) - 1]);
    return '?';
  });
  return { sql: compiled, values: orderedValues };
}

class MysqlClientAdapter implements DatabaseClient {
  constructor(protected readonly connection: ConnectionLike) {}

  async query<T extends QueryResultRow = QueryResultRow>(sql: string, values: readonly unknown[] = []): Promise<QueryResult<T>> {
    const compiled = compileQuery(sql, values);
    const [result] = await this.connection.query<RowDataPacket[] | ResultSetHeader>(compiled.sql, compiled.values);
    if (Array.isArray(result)) return { rows: result as T[], rowCount: result.length };
    return { rows: [], rowCount: result.affectedRows };
  }
}

class MysqlPoolClientAdapter extends MysqlClientAdapter implements PoolClient {
  constructor(private readonly pooledConnection: PoolConnection) {
    super(pooledConnection);
  }

  release(): void {
    this.pooledConnection.release();
  }
}

class MysqlPoolAdapter extends MysqlClientAdapter implements Pool {
  constructor(private readonly mysqlPool: MysqlPool) {
    super(mysqlPool);
  }

  async connect(): Promise<PoolClient> {
    return new MysqlPoolClientAdapter(await this.mysqlPool.getConnection());
  }

  async end(): Promise<void> {
    await this.mysqlPool.end();
  }
}

function connectionOptions(databaseUrl: string, overrides: Partial<PoolOptions>): PoolOptions {
  const parsed = new URL(databaseUrl);
  if (parsed.protocol !== 'mysql:') throw new Error('database.url 必须使用 mysql:// 协议。');
  const database = parsed.pathname.replace(/^\//, '');
  if (!database) throw new Error('database.url 必须包含数据库名。');
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database,
    connectionLimit: Number.parseInt(process.env.DATABASE_POOL_MAX ?? '5', 10),
    connectTimeout: 3_000,
    charset: 'utf8mb4',
    decimalNumbers: true,
    timezone: 'Z',
    typeCast(field, next) {
      if (field.type === 'TINY' && field.length === 1) {
        const value = field.string();
        return value === null ? null : value === '1';
      }
      return next();
    },
    ...overrides,
  };
}

export async function ensureDatabaseExists(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
  const options = connectionOptions(databaseUrl, {});
  const database = String(options.database);
  if (!/^[a-zA-Z0-9_]+$/.test(database)) throw new Error('数据库名只能包含字母、数字和下划线。');

  const direct = createMysqlPool({ ...options, connectionLimit: 1 });
  try {
    await direct.query('SELECT 1');
    return;
  } catch (error) {
    if (!(typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_BAD_DB_ERROR')) {
      throw error;
    }
  } finally {
    await direct.end();
  }

  const bootstrap = createMysqlPool({ ...options, database: undefined, connectionLimit: 1 });
  try {
    await bootstrap.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
  } finally {
    await bootstrap.end();
  }
}

export function createDatabasePool(overrides: Partial<PoolOptions> = {}): Pool {
  const options = connectionOptions(process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL, overrides);
  return new MysqlPoolAdapter(createMysqlPool(options));
}

export async function inTransaction<T>(pool: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('START TRANSACTION');
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
  const result = await client.query<T>(query, values);
  return result.rows[0] ?? null;
}

export async function closeDatabasePool(pool: Pool): Promise<void> {
  await pool.end();
}
