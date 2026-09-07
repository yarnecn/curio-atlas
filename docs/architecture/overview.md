# 架构概览

## 决策摘要

系统采用 TypeScript Monorepo 和模块化单体。Next.js 网站、Taro 小程序、NestJS REST API 与 NestJS standalone worker 共用契约、内容 Schema、纯领域规则、API 客户端和设计变量。PostgreSQL 是事实主库，Redis/BullMQ 处理异步任务，S3 兼容对象存储保存文件。

网站和小程序共用一个内容内核与 API，不重复建设业务后端。两端的第一入口都是打开即看的常识流，不要求用户先搜索或登录。网站额外负责公开传播、SEO、完整投稿和管理审核；小程序负责高频浏览、投票、收藏和可选学习，首版不承载复杂编辑器。

```text
Next.js 网站 ─┐
Taro 小程序 ──┼──> NestJS REST API ──> PostgreSQL
管理后台 ─────┘           │
                          └──> Redis / BullMQ ──> worker
                                                   │
                                                   └──> 对象存储 / 来源 / AI
```

## 应用边界

- `apps/web`：常识流、公开阅读、关系探索、网站投稿、个人中心和首版管理后台；
- `apps/miniprogram`：常识流、阅读、投票、收藏和可选学习；
- `apps/api`：唯一公开业务 API，负责认证、授权、投票、审核与事务边界；
- `apps/worker`：抓取、AI、索引、更新检查、导出和调度任务，不开放公网端口。

API 按以下模块边界组织：

- `auth`：登录身份、合规认证状态和会话；
- `taxonomy`：领域、兴趣、话题和目录；
- `knowledge`：正式节点、版本、claim 和关系；
- `feed`：候选集、已读去重、领域轮换、多样性和预计算推荐；
- `submissions`：候选投稿、版本、尝试展示和状态机；
- `votes`：有用 / 没用、有效性与可重算聚合；
- `sources`：来源、许可、证据和快照元数据；
- `realtime`：实时信息与热点事件；
- `learning`：路径、题目、掌握度和复习；
- `search`：关键词和后续语义检索；
- `ingestion`：抓取、去重、变更检测和审核队列；
- `ai`：模型适配、AI 作业、预算和评测；
- `admin`：审核、发布、配置、审计和举报；
- `export`：个人数据导出；
- `notifications`：订阅和小程序通知。

推荐首版不用在线大模型：由正式内容质量、编辑精选、领域轮换、时效、已读和显式兴趣生成可缓存候选集。文本相似和向量召回只在内容量和数据证明有必要时加入，且永远保留跨领域探索位。

## 数据与依赖规则

1. PostgreSQL 是内容、版本、来源、投票、学习记录、配置和审计数据的事实源；
2. Redis 只承载队列、缓存、限流和短期协调状态，不能成为事实源；
3. Web 和小程序只能经 API 修改业务数据；
4. 外部数据、模型、认证和对象存储必须经 Adapter 接入；
5. 内容正文使用版本化 Block JSON，同时允许导出 Markdown；
6. 原始投稿或系统触发来源、AI 改写和人工定稿分别存储，不能互相覆盖；
7. 票数为可重算派生数据，原始有效评分记录才是事实；
8. AI 只能创建草稿、报告或待审核操作，不能绕过人工审核发布；
9. 所有状态迁移由服务端领域规则执行，客户端不能直接指定最终状态；
10. 正式发布、撤回、合并、阈值和白名单变化必须写审计日志。

## 关键实体

```text
user ── user_identity ── identity_verification
  ├── interest_subscription
  ├── candidate(origin_type) ── candidate_revision ── vote（仅用户候选）
  └── learning / bookmark / report

domain ── topic ── realtime_info ── hot_event
                  └── candidate

knowledge_node ── knowledge_revision ── claim ── source
       └── knowledge_relation

ai_job ── ai_artifact ── approval_request
audit_log / policy_config / source_connector
```

## 本地与生产拓扑

源码开发时可在宿主机分别运行 Web 3000、API 4000 和 worker。生产环境使用单一应用镜像，对外只开放 8080；Web、API、worker 和 Python 抓取器在同一容器中运行，PostgreSQL 与 Redis 保持为外部有状态服务。部署参数和密钥统一读取挂载的 `app.config.json`。

首版生产采用单节点或同一区域的极简拓扑：反向代理、Web、API、低并发 worker、PostgreSQL 和 Redis；静态资源优先使用云对象存储与 CDN。生产不要求照搬本地 MinIO。部署资源预算和扩容触发器见 [低成本部署与性能方案](./cost-performance.md)。

## 演进边界

真实容量或团队边界出现前不拆微服务。PostgreSQL 标题、别名和全文检索先行；内容和推荐评测稳定后再启用 pgvector；独立搜索、托管数据库、多个 worker 或 Kubernetes 只在监控数据证明有必要时评估。数据库选型理由见 [ADR-0004](../adr/0004-keep-postgresql-as-the-fact-store.md)。

AI 管理员采用“观察—建议—验证—审批—执行—回滚”闭环，权限与成本策略见 [AI 管理员方案](./ai-operator.md)。
