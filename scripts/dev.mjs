import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const minimumMajor = 22;
const currentMajor = Number.parseInt(process.versions.node.split('.')[0], 10);

if (currentMajor < minimumMajor) {
  console.error(`Node.js ${minimumMajor}+ is required; current version is ${process.version}.`);
  process.exit(1);
}

const localEnv = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(localEnv)) process.loadEnvFile(localEnv);

const skipInfrastructure = process.argv.includes('--skip-infra') || process.env.SKIP_INFRA === 'true';

if (!skipInfrastructure) {
  const compose = spawnSync('docker', ['compose', 'up', '-d', '--wait'], {
    stdio: 'inherit',
    shell: false,
  });

  if (compose.status !== 0) {
    console.error('Unable to start local infrastructure. Is Docker running?');
    console.error('If PostgreSQL and Redis already run locally, set SKIP_INFRA=true.');
    process.exit(compose.status ?? 1);
  }
}

const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const apps = spawn(pnpmCommand, ['exec', 'turbo', 'run', 'dev', '--parallel'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => apps.kill(signal));
}

apps.on('exit', (code) => process.exit(code ?? 0));
