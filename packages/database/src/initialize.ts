import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { closeDatabasePool, createDatabasePool, ensureDatabaseExists } from './client.js';
import { Phase1Repository } from './phase1-repository.js';
import { seedStarterData } from './starter-data.js';

const rootDirectory = process.env.KNOWLEDGE_MAP_ROOT ?? resolve(import.meta.dirname, '../../..');
const password = process.env.BOOTSTRAP_OWNER_PASSWORD;
const publicHandle = process.env.BOOTSTRAP_OWNER_HANDLE ?? 'site-owner';
const expectedSchemaVersion = '1';

if (!password || password.length < 10 || password.length > 128) {
  throw new Error('owner.initialPassword 必须是 10-128 位密码。');
}

await ensureDatabaseExists();
const pool = createDatabasePool({ connectionLimit: 1 });
try {
  const schema = await readFile(resolve(rootDirectory, 'infra/mysql/schema.sql'), 'utf8');
  const statements = schema
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
  for (const statement of statements) await pool.query(statement);
  const version = await pool.query<{ value: string }>("SELECT `value` FROM app_metadata WHERE `key` = 'schema.version'");
  const currentVersion = version.rows[0]?.value;
  if (currentVersion && currentVersion !== expectedSchemaVersion) {
    throw new Error(`数据库结构版本为 ${currentVersion}，当前镜像只支持 ${expectedSchemaVersion}；请先按对应升级说明处理。`);
  }
  await pool.query(
    "INSERT IGNORE INTO app_metadata (`key`, `value`) VALUES ('schema.version', $1)",
    [expectedSchemaVersion],
  );
  await seedStarterData(pool, rootDirectory);

  const repository = new Phase1Repository(pool);
  if (process.env.BOOTSTRAP_OWNER_RESET === 'true') {
    await repository.bootstrapOwnerPassword(publicHandle, password);
    console.log(`站长账号 ${publicHandle} 的密码已重置。`);
  } else {
    const result = await repository.ensureOwnerPassword(publicHandle, password);
    console.log(result === 'created'
      ? `站长账号 ${publicHandle} 已初始化。`
      : `站长账号 ${publicHandle} 已存在。`);
  }
} finally {
  await closeDatabasePool(pool);
}
