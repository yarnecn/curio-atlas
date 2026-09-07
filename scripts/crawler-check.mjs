import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const localEnv = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(localEnv)) process.loadEnvFile(localEnv);

const python = process.env.PYTHON_BIN ?? 'python';
const result = spawnSync(python, [
  '-B', '-m', 'unittest', 'discover', '-s', 'tools/crawler', '-p', 'test_*.py',
], { cwd: process.cwd(), encoding: 'utf8', windowsHide: true, env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) {
  throw new Error(`Python 3 不可用，请设置 PYTHON_BIN。${result.error.message}`);
}
process.exitCode = result.status ?? 1;
