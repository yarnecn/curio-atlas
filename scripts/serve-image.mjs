import { spawn } from 'node:child_process';
import { createServer, request as proxyRequest } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const configPath = resolve(process.argv[2] ?? resolve(appRoot, 'config/app.config.json'));

function fail(message) {
  console.error(`[config] ${message}`);
  process.exit(1);
}

if (!existsSync(configPath)) fail(`找不到配置文件：${configPath}。请复制 app.config.example.json 后挂载到此位置。`);
let config;
try {
  config = JSON.parse(readFileSync(configPath, 'utf8'));
} catch (error) {
  fail(`配置文件不是有效 JSON：${error instanceof Error ? error.message : String(error)}`);
}

function text(path, value, { allowEmpty = false } = {}) {
  if (typeof value !== 'string' || (!allowEmpty && value.trim() === '')) fail(`${path} 必须是${allowEmpty ? '' : '非空'}字符串。`);
  return value;
}

function integer(path, value, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) fail(`${path} 必须是 ${min}-${max} 的整数。`);
  return value;
}

function boolean(path, value) {
  if (typeof value !== 'boolean') fail(`${path} 必须是 true 或 false。`);
  return value;
}

const publicUrl = text('server.publicUrl', config.server?.publicUrl).replace(/\/$/, '');
let parsedPublicUrl;
try { parsedPublicUrl = new URL(publicUrl); } catch { fail('server.publicUrl 必须是完整的 http/https 地址。'); }
if (!['http:', 'https:'].includes(parsedPublicUrl.protocol)) fail('server.publicUrl 只允许使用 http 或 https。');
const ownerHandle = text('owner.handle', config.owner?.handle);
if (!/^[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?$/.test(ownerHandle) || ownerHandle.length < 3 || ownerHandle.length > 32) {
  fail('owner.handle 必须是 3-32 位小写字母、数字、下划线或连字符。');
}
const ownerPassword = text('owner.initialPassword', config.owner?.initialPassword);
if (ownerPassword.length < 10 || ownerPassword.length > 128 || /change.me|请修改|替换/i.test(ownerPassword)) {
  fail('owner.initialPassword 必须改成你自己的 10-128 位密码，不能保留示例值。');
}

const versionFile = resolve(appRoot, 'VERSION');
const appVersion = existsSync(versionFile) ? readFileSync(versionFile, 'utf8').trim() : 'development';
const internalApiPort = 4000;
const internalWebPort = 3000;
const configOrigin = parsedPublicUrl.origin;

Object.assign(process.env, {
  NODE_ENV: 'production',
  APP_VERSION: appVersion,
  API_PORT: String(internalApiPort),
  PORT: String(internalWebPort),
  HOSTNAME: '127.0.0.1',
  COOKIE_SECURE: String(boolean('server.secureCookies', config.server?.secureCookies)),
  API_CORS_ORIGINS: configOrigin,
  DATABASE_URL: text('database.url', config.database?.url),
  DATABASE_POOL_MAX: String(integer('database.poolMax', config.database?.poolMax, 1, 50)),
  REDIS_HOST: text('redis.host', config.redis?.host),
  REDIS_PORT: String(integer('redis.port', config.redis?.port, 1, 65535)),
  AI_JOB_RECOVERY_INTERVAL_MS: String(integer('worker.aiJobRecoverySeconds', config.worker?.aiJobRecoverySeconds, 5, 3600) * 1000),
  AI_API_KEY: text('ai.apiKey', config.ai?.apiKey ?? '', { allowEmpty: true }),
  SOURCE_AUTOMATION_ENABLED: String(boolean('sources.automationEnabled', config.sources?.automationEnabled)),
  SOURCE_SCAN_INTERVAL_MS: String(integer('sources.scanIntervalMinutes', config.sources?.scanIntervalMinutes, 1, 10080) * 60_000),
  SOURCE_SCAN_BATCH_SIZE: String(integer('sources.scanBatchSize', config.sources?.scanBatchSize, 1, 100)),
  SOURCE_DRAFT_BATCH_SIZE: String(integer('sources.draftBatchSize', config.sources?.draftBatchSize, 1, 50)),
  SOURCE_FETCH_TIMEOUT_SECONDS: String(integer('sources.fetchTimeoutSeconds', config.sources?.fetchTimeoutSeconds, 5, 60)),
  SOURCE_MAX_BYTES: String(integer('sources.maxResponseBytes', config.sources?.maxResponseBytes, 100_000, 5_000_000)),
  PYTHON_BIN: text('sources.pythonExecutable', config.sources?.pythonExecutable),
  CRAWLER_SCRIPT_PATH: resolve(appRoot, 'tools/crawler/fetch_source.py'),
  KNOWLEDGE_MAP_ROOT: appRoot,
  BOOTSTRAP_OWNER_HANDLE: ownerHandle,
  BOOTSTRAP_OWNER_PASSWORD: ownerPassword,
  BOOTSTRAP_OWNER_ONLY_IF_MISSING: String(!boolean('owner.resetPasswordOnStart', config.owner?.resetPasswordOnStart)),
});

function firstExisting(paths) {
  const found = paths.find(existsSync);
  if (!found) fail(`镜像缺少运行文件：${paths.join(' 或 ')}`);
  return found;
}

const apiEntry = firstExisting([resolve(appRoot, 'apps/api/dist/main.js')]);
const workerEntry = firstExisting([resolve(appRoot, 'apps/worker/dist/main.js')]);
const webEntry = firstExisting([
  resolve(appRoot, 'apps/web/server.js'),
  resolve(appRoot, 'apps/web/.next/standalone/apps/web/server.js'),
]);
const databaseDist = firstExisting([
  resolve(appRoot, 'apps/api/node_modules/@knowledge-map/database/dist'),
  resolve(appRoot, 'packages/database/dist'),
]);

function runInitialization(name, entry, args = []) {
  return new Promise((resolvePromise, reject) => {
    console.log(`[startup] ${name}`);
    const child = spawn(process.execPath, [entry, ...args], { cwd: appRoot, env: process.env, stdio: 'inherit', windowsHide: true });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolvePromise() : reject(new Error(`${name} 失败，退出码 ${code ?? 'unknown'}`)));
  });
}

if (boolean('database.migrateOnStart', config.database?.migrateOnStart)) {
  await runInitialization('执行数据库迁移', resolve(databaseDist, 'migrate.js'), ['up']);
}
if (boolean('database.seedStarterOnFirstStart', config.database?.seedStarterOnFirstStart)) {
  await runInitialization('写入首版目录和示例数据（幂等）', resolve(databaseDist, 'seed.js'));
}
await runInitialization('确认站长初始账号', resolve(databaseDist, 'bootstrap-owner.js'));

let shuttingDown = false;
const children = [];
function startProcess(name, entry, cwd = appRoot) {
  const child = spawn(process.execPath, [entry], { cwd, env: process.env, stdio: 'inherit', windowsHide: true });
  children.push(child);
  child.once('exit', (code) => {
    if (!shuttingDown) {
      console.error(`[runtime] ${name} 意外退出，退出码 ${code ?? 'unknown'}。`);
      void shutdown(1);
    }
  });
  return child;
}

startProcess('API', apiEntry);
startProcess('worker', workerEntry);
startProcess('Web', webEntry, dirname(webEntry));

async function waitFor(url, name) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return;
    } catch {}
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  throw new Error(`${name} 未能在 30 秒内就绪。`);
}

await Promise.all([
  waitFor(`http://127.0.0.1:${internalApiPort}/health`, 'API'),
  waitFor(`http://127.0.0.1:${internalWebPort}/`, 'Web'),
]);

const listenPort = integer('server.port', config.server?.port, 1, 65535);
const gateway = createServer((incoming, outgoing) => {
  if (incoming.url === '/healthz') {
    outgoing.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    outgoing.end(JSON.stringify({ status: 'ok', version: appVersion }));
    return;
  }
  const isApi = incoming.url === '/api' || incoming.url?.startsWith('/api/');
  const port = isApi ? internalApiPort : internalWebPort;
  const path = isApi ? (incoming.url?.slice(4) || '/') : (incoming.url || '/');
  const headers = { ...incoming.headers, host: `127.0.0.1:${port}`, 'x-forwarded-host': incoming.headers.host ?? '', 'x-forwarded-proto': new URL(publicUrl).protocol.slice(0, -1) };
  const proxied = proxyRequest({ hostname: '127.0.0.1', port, path, method: incoming.method, headers }, (response) => {
    outgoing.writeHead(response.statusCode ?? 502, response.headers);
    response.pipe(outgoing);
  });
  proxied.on('error', (error) => {
    if (!outgoing.headersSent) outgoing.writeHead(502, { 'content-type': 'application/json; charset=utf-8' });
    outgoing.end(JSON.stringify({ message: `内部服务暂不可用：${error.message}` }));
  });
  incoming.pipe(proxied);
});

gateway.listen(listenPort, '0.0.0.0', () => {
  console.log(`[ready] 常识地图 ${appVersion} 已启动：${publicUrl}（容器端口 ${listenPort}）`);
  console.log(`[ready] 所有配置来自 ${configPath}`);
});

async function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  await new Promise((resolvePromise) => gateway.close(resolvePromise));
  for (const child of children) child.kill('SIGTERM');
  setTimeout(() => process.exit(exitCode), 5_000).unref();
  await Promise.all(children.map((child) => new Promise((resolvePromise) => child.once('exit', resolvePromise))));
  process.exit(exitCode);
}

process.once('SIGTERM', () => void shutdown(0));
process.once('SIGINT', () => void shutdown(0));
