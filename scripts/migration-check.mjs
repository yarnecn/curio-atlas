import { mkdir, readdir } from 'node:fs/promises';

const migrationRoot = new URL('../infra/migrations', import.meta.url);
await mkdir(migrationRoot, { recursive: true });
const files = (await readdir(migrationRoot)).filter((name) => !name.startsWith('.'));
const invalid = files.filter((name) => !/^\d{4}_[a-z0-9_]+\.(up|down)\.sql$/.test(name));

if (invalid.length > 0) {
  console.error(`Invalid migration filenames: ${invalid.join(', ')}`);
  process.exit(1);
}

const versions = new Map();
for (const file of files) {
  const match = /^(\d{4}_[a-z0-9_]+)\.(up|down)\.sql$/.exec(file);
  if (!match) continue;
  const [, version, direction] = match;
  const directions = versions.get(version) ?? new Set();
  directions.add(direction);
  versions.set(version, directions);
}

const incomplete = [...versions.entries()]
  .filter(([, directions]) => !directions.has('up') || !directions.has('down'))
  .map(([version]) => version);
if (incomplete.length > 0) {
  console.error(`Migrations missing an up/down pair: ${incomplete.join(', ')}`);
  process.exit(1);
}

console.log(`Migration check passed (${versions.size} paired migrations).`);
