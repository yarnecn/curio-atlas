# 常识地图

面向成年人的、打开即看的主动推荐型常识百科。Phase 0 工程骨架和 Phase 1 内容内核与审核闭环已完成封板。

## 推荐部署方式

生产部署使用一个 Docker 镜像：网站、API、worker 和 Python 抓取器全部内置，只需外部 PostgreSQL、Redis 和一个 JSON 配置文件。构建、运行和按版本升级见 [单镜像部署](./infra/deployment/README.md)，配置模板见 [app.config.example.json](./config/app.config.example.json)。

## 本地要求

- Node.js 22.12 或更高版本（推荐 Node.js 24）
- pnpm 11
- Python 3.11+（只在不使用生产镜像的本地源码开发时需要；镜像已内置）
- Docker Desktop / Docker Engine + Compose v2

Windows 首次使用 pnpm 时，如果本机已安装较老的 Node.js，请先切换到 Node.js 22/24，再运行下面的命令。

## 首次启动

```bash
pnpm install
pnpm infra:up
pnpm db:migrate
pnpm db:seed
pnpm auth:bootstrap-owner
pnpm dev:apps
```

这部分仅供修改源码的开发者使用，生产运行不需要执行这些命令。运行 `pnpm auth:bootstrap-owner` 前，开发者需要临时设置 `BOOTSTRAP_OWNER_PASSWORD`；生产站长账号完全由 `app.config.json` 初始化。`pnpm dev:apps` 会并行启动：

- 网站：http://localhost:3000
- API：http://localhost:4000/health
- worker：连接 Redis 后消费一次启动自检任务
- MinIO 控制台：http://localhost:9001

停止前台应用使用 `Ctrl+C`；基础设施默认保留运行，使用 `pnpm infra:down` 停止。

如果只开发前端或 API，可以先运行 `pnpm infra:up`，再运行：

```bash
pnpm --filter @knowledge-map/web dev
pnpm --filter @knowledge-map/api dev
pnpm --filter @knowledge-map/worker dev
pnpm --filter @knowledge-map/miniprogram dev
```

本机已经单独运行 PostgreSQL 和 Redis 时，可以在 `.env` 配置连接信息并设置 `SKIP_INFRA=true`，然后运行 `pnpm dev`。Redis 只供 API 和 worker 使用，Web/小程序统一通过 API 访问业务数据。

## 质量检查

```bash
pnpm check
pnpm content:status
docker compose config --quiet
```

`pnpm check` 依次执行 lint、类型检查、单元测试、内容规范检查、V1 目录检查、Python 抓取器语法检查、迁移检查和生产构建。`pnpm content:status` 查看各话题的已发布、待审核和 V1 目标数量。

## 你可以做什么

完整操作步骤见 [功能清单](./docs/product/function-list.md)。需要交给其他 AI 接续时，先让它阅读 [接续说明](./docs/START-HERE.md)；准备部署生产时按 [部署与安装](./infra/deployment/README.md) 执行。

## 目录

```text
apps/
  web/          Next.js 公开网站、个人中心和首版管理后台
  miniprogram/  Taro + React 微信小程序
  api/          NestJS REST API
  worker/       NestJS standalone worker + BullMQ
packages/
  contracts/ content-schema/ domain/ api-client/
  design-tokens/ config/ test-fixtures/
infra/
  docker/ migrations/ deployment/
docs/
  product/ architecture/ adr/ content-guidelines/
```

## 源码开发配置

本地默认值已经能直接运行。只有修改源码时才会用 `.env`：需要覆盖开发机连接信息时，将 [.env.example](./.env.example) 复制为 `.env`，不要提交真实密钥。生产镜像不读取这份文件，也不要求用户设置环境变量；它只读取挂载的 `config/app.config.json`。

## 当前边界

- 已实现匿名浏览、昵称注册、密码登录和服务端会话；投稿/评分需要登录，审核后台按角色隔离。找回密码、管理员多因素认证和公网限流仍是上线门槛。
- 首页一次按领域比例展示最多 12 条闭环短文；详情页支持沿相关常识连续阅读。搜索、已读去重和个性化留在后续阶段。
- 内部编辑候选可以绕开公开投票进入人工审核，正式常识支持追加版本和可审计回滚。
- AI 处理可在管理台选择零 Token 规则模式、本地 Ollama 或 OpenAI 兼容接口；生产远程密钥只从挂载配置文件读取。
- 白名单来源监测、内容指纹、证据摘要和 AI 候选生成链路已实现，但默认关闭，且不会自动搜索全网来源。
- 尚未实现公开搜索和完整学习系统。
- 外部信息不会自动发布。
- Docker 未运行时仍可执行静态检查和构建，但完整启动需要 Docker daemon。

产品方向与闭环见 [产品愿景与闭环](./docs/product/product-vision-and-loops.md)，产品边界见 [MVP PRD](./docs/product/mvp.md)，架构见 [架构概览](./docs/architecture/overview.md)，本阶段运行细节见 [Phase 1 实现说明](./docs/product/phase-1-implementation.md)。
