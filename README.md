# 常识地图 · Curio Atlas

打开就能读懂一点新知识，也能随手记录自己的发现，让有价值的内容经过人工审核沉淀为常识。

常识地图是一个浏览优先的轻量常识百科，提供 Web 和微信小程序。它不是问答论坛，也不是要求用户先搜索、再制定学习计划的工具：从“随便看看”开始，读一条短文，再沿着相关常识继续探索。

## 你可以做什么

- **随便看看**：匿名浏览、领域筛选、关键词查找与相关常识跳转。
- **先记下来**：私密随手记不强制标题，也可通过记录 API 保存灵感；整理好后再转投稿，不会自动公开。
- **参与试读**：首页穿插已通过初审的候选，支持详情阅读与有用性评分；作者不能给自己评分。
- **贡献常识**：填写标题、简短结论与用途；特殊条件和来源按需补充，提交后进入预处理与人工审核。
- **维护内容**：后台支持初审、正式收录、拒绝、暂缓、合并与版本回滚，以及白名单抓取和 AI 整理。

小程序采用“看看、收藏、我的”导航，不照搬网站；收藏保存在本机，不跨设备同步。

## 内容如何公开

私密记录 → 整理投稿 → 自动预处理 → 人工初审 → 公开试读 → 人工决定正式收录。

来源是可选的审核参考，个人经验或没有来源不自动禁止收录；有用票也不代表内容为真，不是正式收录的硬门槛。内部编辑候选不参与公开凑票，但仍需人工审核。AI 不拥有最终发布权。

## 当前阶段

截至 2026-10-14，按站长反馈，网站与小程序均已发布；项目处于 Phase 2，重点是完善阅读、记录、投稿和审核体验。本文描述当前源码能力，不保证所有改动已经部署到线上。

下一步优先处理结构化草稿恢复、历史候选标题维护和两端真实使用验收，再结合内容供给与用户反馈改进。完整计划见[候选体验方案](./docs/product/candidate-experience-plan.md)。

## 本地运行

要求：Node.js 24、pnpm 11、MySQL 8.4、Redis。

1. 复制 `config/app.config.example.json` 为 `config/app.config.json`。
2. 把数据库账号、Redis 地址和站长初始密码改成自己的配置。模板已按本机 `localhost` 设置。
3. 首次安装依赖，再启动 Web、API 和 worker：

```bash
pnpm install
pnpm start
```

打开 <http://localhost:8080>。停止时按 `Ctrl+C`。

启动过程会自动完成这些工作：构建应用、创建空 MySQL 数据库、检查完整表结构、补齐 12 个领域和 48 个话题、写入 20 篇闭环示例常识、初始化站长账号，然后启动网站、API 和 worker。所有写入均为幂等操作，重复启动不会产生重复内容，也不会重置已有密码。

MySQL 和 Redis 由你自行准备；项目启动不会下载或创建数据库、Redis 容器。

小程序另开终端运行 `pnpm --filter @knowledge-map/miniprogram dev`，在微信开发者工具中打开 `apps/miniprogram`。这个命令只编译小程序，不启动后端；使用线上 API 时无需运行本地后端。API 地址与发布步骤见[小程序说明](./docs/operations/miniprogram.md)。

## 构建镜像

```bash
npm run image:build
```

镜像名为 `curio-atlas:0.1.0`，网站、API、worker 和 Python 抓取器都在镜像内。运行镜像时只需挂载 `config/app.config.json`，参考 [部署说明](./infra/deployment/README.md)。

## 配置原则

- 应用只读取 `config/app.config.json`，不要求用户设置环境变量。
- 源码本地运行的 MySQL 示例地址是 `mysql://knowledge_map:knowledge_map_dev@localhost:3306/knowledge_map`。
- 容器连接宿主机服务时，把主机名改为 `host.docker.internal`。
- `owner.initialPassword` 必须是自己的 10–128 位密码；`resetPasswordOnStart` 保持 `false`。
- AI 默认为零 Token 的规则模式；可在管理台切换本地 Ollama 或 OpenAI 兼容接口。

## 项目入口

- 使用功能：[功能清单](./docs/product/function-list.md)
- 随手记与记录 API：[操作说明](./docs/operations/personal-notes.md)
- 微信小程序：[开发与发布](./docs/operations/miniprogram.md)
- 审核规则：[投稿初审](./docs/operations/submission-initial-review.md) · [来源政策](./docs/product/source-review-policy.md)
- 交给其他 AI 接续：[接续说明](./docs/START-HERE.md)
- 安装与部署：[单镜像部署](./infra/deployment/README.md)
- 产品方向：[产品愿景与闭环](./docs/product/product-vision-and-loops.md)
- 系统设计：[架构概览](./docs/architecture/overview.md)

## 代码结构

```text
apps/                 网站、小程序、API、worker
packages/             共享契约、领域规则、数据库和设计变量
content/v1/           首版内容目录
infra/mysql/          MySQL 完整建库结构
tools/crawler/        Python 白名单抓取器
config/               唯一运行配置模板
docs/                 产品、架构、内容和接续文档
```

数据库从 MySQL 空库开始，不提供 PostgreSQL 数据迁移、回滚或双数据库兼容层。外部抓取内容不会自动发布，必须经过 AI 整理与人工审核。

## 独立小程序：芝麻开庭

基于同一服务端新增生活趣事模拟法庭，独立入口为 apps/court-miniprogram，包含立案、审核、陪审投票、角色发言与结案。运行与发布见 [法庭小程序说明](./docs/operations/court-miniprogram.md)。
