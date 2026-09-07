import { cp, mkdir } from 'node:fs/promises';

const standaloneApp = new URL('../.next/standalone/apps/web/', import.meta.url);
const staticSource = new URL('../.next/static/', import.meta.url);
const staticTarget = new URL('../.next/standalone/apps/web/.next/static/', import.meta.url);

await mkdir(standaloneApp, { recursive: true });
await cp(staticSource, staticTarget, { recursive: true, force: true });

try {
  const publicSource = new URL('../public/', import.meta.url);
  const publicTarget = new URL('../.next/standalone/apps/web/public/', import.meta.url);
  await cp(publicSource, publicTarget, { recursive: true, force: true });
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

console.log('Standalone static assets prepared.');
