import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const configPath = resolve('config/app.config.json');
let configuredPython;
if (existsSync(configPath)) {
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  configuredPython = config.sources?.pythonExecutable;
}

const candidates = [...new Set([configuredPython, process.platform === 'win32' ? 'python' : 'python3', 'python'].filter(Boolean))];
let result;
for (const python of candidates) {
  result = spawnSync(python, [
    '-B', '-m', 'unittest', 'discover', '-s', 'tools/crawler', '-p', 'test_*.py',
  ], { cwd: process.cwd(), encoding: 'utf8', windowsHide: true, env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
  if (!result.error) break;
}

if (result?.stdout) process.stdout.write(result.stdout);
if (result?.stderr) process.stderr.write(result.stderr);
if (!result || result.error) {
  throw new Error('Python 3 不可用，请修改 config/app.config.json 的 sources.pythonExecutable。');
}
process.exitCode = result.status ?? 1;
