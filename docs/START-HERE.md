# 常识地图接续说明

这份文档是交给下一位 AI 或开发者的入口。先读本页，再按任务读取对应文档；不要把未实现的规划当成已经上线的功能。

## 当前状态

- 阶段：Phase 1 封板，内容内核、昵称账号、投稿候选、评分、人工审核、发布、版本、回滚和相关常识连续阅读已完成。
- 技术：TypeScript monorepo、Next.js 网站、NestJS API、NestJS worker、Taro 微信小程序、PostgreSQL、Redis/BullMQ。
- 本地入口：网站 `http://localhost:3000`，API `http://localhost:4000/health`。
- 生产交付是单个 `knowledge-map:<版本>` 镜像；Web、API、worker 和 Python 均在镜像内，对外只开放 8080。全部用户配置来自挂载的 `config/app.config.json`。
- 正式内容接口 `/knowledge` 返回完整短文 sections，不要只渲染 summary。
- V1 内容建设已启动：目录为 12 个一级领域、48 个细分话题和 165 条稳定常识；编辑批次 01 共提供 14 条有直接来源的候选，实际通过与待审数量以审核台为准。
- 当前已发布内容仍包含 starter 展示内容，不等于站长已经按 V1 标准验收；准确数量用 `pnpm content:status` 查询，后续必须纳入复核或替换。
- 浏览保持匿名；投稿和评分需要昵称账号；审核后台只允许 `reviewer` / `owner`。服务端使用 HttpOnly 会话 Cookie，旧的 `x-user-id` 开发直通已移除。
- 首次进入后台前必须运行 `pnpm auth:bootstrap-owner` 设置站长密码；仓库不提供默认密码。
- `/admin/operations` 可动态新增、停用领域和话题，管理白名单来源，并选择规则、本地 Ollama 或 OpenAI 兼容 AI 模式。密钥只从挂载配置的 `ai.apiKey` 读取。
- Python 支持指定单页手动抓取，以及从指定 HTTPS 站点入口发现最多 20 个同源同路径页面；自动维护由来源自身开关与全局配置共同控制。
- 管理台“立即抓取”会通过队列唤醒 worker；源码维护人员仍可用 `pnpm source:once` 执行整批到期来源。具体步骤见 `docs/operations/bulk-source-run.md`。

## 必读顺序

1. [产品愿景与闭环](product/product-vision-and-loops.md)：明确这是主动推荐型常识百科，不是问答知识库。
2. [MVP 产品基线](product/mvp.md)：功能边界、用户路径和暂不做的能力。
3. [内容规范](content-guidelines/knowledge-node.md)：发布前的内容闭环和来源要求。
4. [功能清单](product/function-list.md)：站长、访客、投稿者如何实际操作。
5. [部署说明](../infra/deployment/README.md)：本地、生产、更新、备份和回滚。
6. [Phase 1 实现说明](product/phase-1-implementation.md)：数据库、API 和验收记录。
7. [V1 内容生产计划](product/v1-content-plan.md)：165 条首版目录、来源与分批审核方式。

## 代码导航

| 任务 | 入口 |
| --- | --- |
| 页面与交互 | `apps/web/src/app` |
| API 路由 | `apps/api/src` |
| 异步 AI 与来源监测 | `apps/worker/src`、`tools/crawler/fetch_source.py` |
| 数据库访问与事务 | `packages/database/src/phase1-repository.ts` |
| 请求与内容校验 | `packages/content-schema/src/index.ts` |
| 跨端类型 | `packages/contracts/src/index.ts` |
| 前端 API 调用 | `packages/api-client/src/index.ts` |
| 迁移与种子 | `infra/migrations`、`infra/seeds` |

## 不可破坏的规则

- 访客阅读正式常识不需要注册；投稿、评分和审核必须有权限。
- 用户投稿和内部编辑候选用 `origin_type` 区分；内部候选不能伪装成用户票数。
- 任何候选都不能绕过 AI 检查和人工审核直接成为正式常识。
- 正式内容修改只能创建新版本，不能覆盖旧版本；回滚也是创建新版本。
- 正式短文必须直接回答标题，至少两个短段落、必要边界和可核验来源。
- 首页一次最多展示 12 条，并按一级领域库存比例分配；正式常识详情页必须提供可继续点击的相关常识。
- AI 可以整理和提出更新建议，不能替代事实核验和最终发布决定。
- 不新增公开评论区、实名强制或无审核直发。

## 接续工作方式

先运行 `pnpm check`。如果只改页面，至少运行对应 app 的 lint、typecheck 和 build；如果改数据库，必须新增成对的 `.up.sql` / `.down.sql`，执行迁移、回滚、再迁移，并更新 `docs/product/phase-1-implementation.md`。

任何新功能先回答三个问题：它服务哪条用户闭环？是否会把实时信息、候选精华和正式常识混在一起？是否增加了站长无法维护的人工负担？没有明确答案时不要扩展代码。

## 当前明确未完成

找回密码、管理员多因素认证、限流、封禁/注销、剩余 V1 内容批次、主动寻找新来源、已读去重、公开搜索、完整小程序业务页和商业化运营仍是后续阶段。现有抓取只处理站长加入的白名单页面或有页数上限的同站目录，不是无边界全网搜索；编辑批次 01 是人工核对来源后导入的候选。
