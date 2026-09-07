import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { closeDatabasePool, createDatabasePool, inTransaction } from './client.js';

const environmentFile = resolve(import.meta.dirname, '../../../.env');
if (existsSync(environmentFile)) process.loadEnvFile(environmentFile);

const seedsDirectory = process.env.KNOWLEDGE_MAP_ROOT
  ? resolve(process.env.KNOWLEDGE_MAP_ROOT, 'infra/seeds')
  : resolve(import.meta.dirname, '../../../infra/seeds');
const pool = createDatabasePool({ max: 1 });

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS seed_runs (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  const files = (await readdir(seedsDirectory)).filter((file) => file.endsWith('.sql')).sort();
  const appliedResult = await pool.query<{ name: string }>('SELECT name FROM seed_runs');
  const applied = new Set(appliedResult.rows.map(({ name }) => name));

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(resolve(seedsDirectory, file), 'utf8');
    await inTransaction(pool, async (client) => {
      await client.query(sql);
      await client.query('INSERT INTO seed_runs (name) VALUES ($1)', [file]);
    });
    console.log(`Seeded ${file}`);
  }
} finally {
  await closeDatabasePool(pool);
}
