# 微信小程序首版

小程序代码位于 `apps/miniprogram`，和网站共用 API、账号和内容，采用独立的“看看、收藏、我的”底部导航。

## 本版已实现

- 看看：按领域浏览；点击卡片创建来源标记筛选，再点清除恢复。超过 8 条时可换一批，批次可能有重叠。
- 常识详情：完整正文、阅读时长、来源标记、收藏、相关常识跳转。
- 收藏：独立底部入口，本机保存、无需登录，可查看和取消收藏；不会跨设备同步。
- 我的：登录、注册、退出登录、投稿和尝试池入口；版本号只放在这里。
- 登录/注册：使用昵称账号，不要求实名；阅读不登录也能用。
- 投稿：登录后直接提交精华内容，沿用服务端的 AI 预处理和人工审核。
- 尝试池：查看候选内容并点“有用/没用”，评分仍走服务端权限和去重规则。

## 本地运行

在仓库根目录执行：

```powershell
pnpm install
pnpm --filter @knowledge-map/miniprogram dev
```

另开终端在仓库根目录执行 `pnpm start`，启动本地 API。然后用微信开发者工具打开 `apps/miniprogram`（项目配置的 `miniprogramRoot` 为 `dist/`）。开发者工具中可勾选“不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书”。小程序编译命令不会启动 API；使用线上 API 时无需启动本地服务。

如果电脑没有全局 `pnpm`，使用项目已有的 pnpm 命令路径，或先通过 Corepack 启用 pnpm。

## API 地址

API 地址集中在 `apps/miniprogram/src/api.ts` 的 `API_BASE_URL`：

- 本地开发：`http://127.0.0.1:8080/api`
- 真机预览和发布：改为已备案并加入小程序“request 合法域名”的 HTTPS 地址，例如 `https://atlas.yarne.cc/api`

改完 API 地址后重新执行小程序构建，再在开发者工具中点击“编译”。服务端仍然使用现有的账号和 MySQL 数据，不需要新增表。

## 版本号

网站、API、Docker 镜像和小程序使用同一个发布版本号。构建小程序时设置 `APP_VERSION`，例如：

```powershell
$env:APP_VERSION = '0.1.6'
pnpm --filter @knowledge-map/miniprogram build
```

Docker 镜像发布时使用相同版本作为 `--build-arg APP_VERSION`。开发环境未设置时，小程序显示 `development`，服务端健康检查也显示 `development`。

## 真机/发布前检查

开发命令输出 `apps/miniprogram/dist`，发布构建输出 `apps/miniprogram/dist-release`，避免发布构建覆盖正在运行的开发 watcher。发布时在微信开发者工具中单独导入 `dist-release` 目录；日常开发仍打开 `apps/miniprogram`。

构建后可执行 `node scripts/check-miniprogram-runtime.mjs` 检查开发产物，或 `node scripts/check-miniprogram-runtime.mjs apps/miniprogram/dist-release` 检查发布产物。检查涵盖应用注册、三个 Tab 页面多次显示与正文生成；模拟微信宿主，不替代真机验收。运行异常在控制台以 `[mini-runtime]` 标记。

1. Caddy 或其他网关已将域名转发到应用容器的 8080 端口。
2. 微信公众平台已配置 HTTPS request 合法域名。
3. API 地址不是 `127.0.0.1`、`localhost` 或 HTTP。
4. 先用开发者工具检查：匿名阅读、详情跳转、登录、投稿、尝试池评分。
5. 发布前删除开发者工具中的“不校验合法域名”设置，并重新编译一次。

## 当前已知限制

- 当前首页为轻量首版，使用 `/knowledge` 一次读取已发布列表；内容增长到数百条后，应切换为分页或游标接口，避免弱网设备一次下载全部内容；
- `API_BASE_URL` 仍是构建时地址，本地可用 `127.0.0.1`，真机和生产必须改成备案后的 HTTPS 地址；
- 登录、投稿和评分已接通，但正式上线前还要在真机验证会话 Cookie、弱网重试、重复点击和账号退出；
- 分享卡片、下拉刷新和更完整的微信隐私授权提示属于后续小程序适配，不复制 Web 页面实现。
