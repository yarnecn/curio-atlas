import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { closeDatabasePool, createDatabasePool, inTransaction } from './client.js';

const environmentFile = resolve(import.meta.dirname, '../../../.env');
if (existsSync(environmentFile)) process.loadEnvFile(environmentFile);

const direction = process.argv[2] ?? 'up';
if (direction !== 'up' && direction !== 'down') {
  throw new Error('Usage: pnpm db:migrate | pnpm db:rollback');
}

const migrationsDirectory = process.env.KNOWLEDGE_MAP_ROOT
  ? resolve(process.env.KNOWLEDGE_MAP_ROOT, 'infra/migrations')
  : resolve(import.meta.dirname, '../../../infra/migrations');
const pool = createDatabasePool({ max: 1 });

async function ensureMigrationTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function migrateUp(): Promise<void> {
  const files = (await readdir(migrationsDirectory))
    .filter((file) => file.endsWith('.up.sql'))
    .sort();
  const appliedResult = await pool.query<{ version: string }>('SELECT version FROM schema_migrations');
  const applied = new Set(appliedResult.rows.map(({ version }) => version));

  for (const file of files) {
    const version = file.replace(/\.up\.sql$/, '');
    if (applied.has(version)) continue;
    const sql = await readFile(resolve(migrationsDirectory, file), 'utf8');
    await inTransaction(pool, async (client) => {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
    });
    console.log(`Applied ${version}`);
  }
}

async function migrateDown(): Promise<void> {
  const latest = await pool.query<{ version: string }>(
    'SELECT version FROM schema_migrations ORDER BY applied_at DESC, version DESC LIMIT 1',
  );
  const version = latest.rows[0]?.version;
  if (!version) {
    console.log('No migration to roll back.');
    return;
  }
  const sql = await readFile(resolve(migrationsDirectory, `${version}.down.sql`), 'utf8');
  await inTransaction(pool, async (client) => {
    await client.query(sql);
    await client.query('DELETE FROM schema_migrations WHERE version = $1', [version]);
  });
  console.log(`Rolled back ${version}`);
}

try {
  await ensureMigrationTable();
  if (direction === 'up') await migrateUp();
  else await migrateDown();
} finally {
  await closeDatabasePool(pool);
}
