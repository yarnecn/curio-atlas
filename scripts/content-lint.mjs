import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const docsRoot = fileURLToPath(new URL('../docs', import.meta.url));
const errors = [];

async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await visit(path);
      continue;
    }
    if (!entry.name.endsWith('.md')) continue;
    const content = await readFile(path, 'utf8');
    if (!content.startsWith('# ')) errors.push(`${path}: missing level-1 title`);
    if (content.includes('\r')) errors.push(`${path}: use LF line endings`);
  }
}

await visit(docsRoot);

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log('Content documentation check passed.');
