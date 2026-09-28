import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// Minimal host smoke test: executes the real compiled Taro pages without opening DevTools.
const root = path.resolve(process.argv[2] ?? 'apps/miniprogram/dist');
const pages = new Map();
let app;
let currentPage;
let registering;
const instances = new Map();
const errors = [];
const wx = {
  getSystemInfoSync: () => ({ platform: 'devtools', language: 'zh_CN', pixelRatio: 1 }),
  getAppBaseInfo: () => ({ platform: 'devtools', language: 'zh_CN' }),
  getDeviceInfo: () => ({ platform: 'devtools' }),
  getWindowInfo: () => ({ windowWidth: 375, windowHeight: 812, pixelRatio: 1 }),
  getStorageSync: () => '',
  setStorageSync: () => {},
  request: (options) => setTimeout(() => options.success({ statusCode: 200, data: options.url.endsWith('/auth/me') ? { user: null } : [], header: {}, cookies: [] }), 0),
  nextTick: (callback) => setTimeout(callback, 0),
  canIUse: () => false,
};
const context = vm.createContext({
  console: { ...console, error: (...args) => { errors.push(args); console.error(...args); } },
  setTimeout, clearTimeout, setInterval, clearInterval, wx,
  App: (value) => { app = value; },
  Page: (value) => pages.set(registering, value),
  Component: () => {},
  getApp: () => app,
  getCurrentPages: () => currentPage ? [currentPage] : [],
});
const loaded = new Set();
function load(file) {
  file = path.resolve(file);
  if (loaded.has(file)) return;
  loaded.add(file);
  context.require = (name) => load(path.resolve(path.dirname(file), `${name}.js`));
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
}
load(path.join(root, 'app.js'));
await new Promise((resolve) => setTimeout(resolve, 50));
assert.ok(app, 'App not registered: check for mixed development/production chunks');
app.onLaunch?.({ path: 'pages/index/index', query: {} });
for (const route of Array(3).fill(['pages/index/index', 'pages/favorites/index', 'pages/profile/index']).flat()) {
  registering = route;
  load(path.join(root, `${route}.js`));
  const config = pages.get(route);
  if (!config) throw new Error(`Page not registered: ${route}`);
  const fresh = !instances.has(route);
  currentPage = instances.get(route) ?? {
    ...config, route, options: {}, data: structuredClone(config.data),
    setData(update, cb) {
      for (const [key, value] of Object.entries(update)) {
        const keys = key.replace(/\[(\d+)\]/g, '.$1').split('.');
        let target = this.data;
        for (const part of keys.slice(0, -1)) target = target[part] ??= {};
        target[keys.at(-1)] = value;
      }
      cb?.();
    },
  };
  instances.set(route, currentPage);
  if (fresh) currentPage.onLoad?.({});
  currentPage.onShow?.();
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.ok(currentPage.data.root.cn.length > 0, `${route}: empty rendered root`);
  const expected = { 'pages/index/index': '随手认识一点', 'pages/favorites/index': '留着慢慢看', 'pages/profile/index': '我的' };
  assert.ok(JSON.stringify(currentPage.data).includes(expected[route]), `${route}: title missing`);
  console.log(`PASS ${route}: rendered root and title`);
  currentPage.onHide?.();
}
assert.equal(errors.length, 0, 'Runtime errors detected');
console.log('PASS 9 page shows (mock WeChat host; not a simulator or real-device test)');
