import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function fail(message) {
  console.error(`[config] ${message}`);
  process.exit(1);
}

export function loadAppConfig(argument) {
  const configPath = resolve(argument ?? resolve(appRoot, 'config/app.config.json'));
  if (!existsSync(configPath)) {
    fail(`找不到配置文件：${configPath}。请复制 app.config.example.json 后再运行。`);
  }
  try {
    return { config: JSON.parse(readFileSync(configPath, 'utf8')), configPath };
  } catch (error) {
    fail(`配置文件不是有效 JSON：${error instanceof Error ? error.message : String(error)}`);
  }
}

export function text(path, value, { allowEmpty = false } = {}) {
  if (typeof value !== 'string' || (!allowEmpty && value.trim() === '')) {
    fail(`${path} 必须是${allowEmpty ? '' : '非空'}字符串。`);
  }
  return value;
}

export function integer(path, value, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) {
    fail(`${path} 必须是 ${min}-${max} 的整数。`);
  }
  return value;
}

export function boolean(path, value) {
  if (typeof value !== 'boolean') fail(`${path} 必须是 true 或 false。`);
  return value;
}

export function firstExisting(paths) {
  const found = paths.find(existsSync);
  if (!found) fail(`缺少运行文件：${paths.join(' 或 ')}。请先构建工程。`);
  return found;
}

export function readAppVersion() {
  const versionFile = resolve(appRoot, 'VERSION');
  return existsSync(versionFile) ? readFileSync(versionFile, 'utf8').trim() : 'development';
}
