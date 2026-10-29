# 产品参考

源码根目录：`C:/workspace/idea-t`。以下路径均相对此根目录。字段快照核对于 2026-10-21；未来使用时重新读取当前 schema 和页面，不能假定线上已包含本地修改。

## 内容字段

普通投稿 `/contribute` 使用 `CreateSubmissionInput`：

| 字段 | 当前规则 | 写作要求 |
| --- | --- | --- |
| proposedTitle | 2–80 字符 | 具体知识点，不用领域名加“候选试读”代替标题 |
| topicId | 真实话题 UUID | 从当前话题列表选择 |
| statement | 12–160 字符 | 一条直接、可理解的结论 |
| whyUseful | 12–300 字符 | 说明使用场景与价值，不重复结论 |
| applicability | 空或 8–300 字符 | 必要条件、时间、地域或例外；无须凑字 |
| sourceUrl | 空或有效 URL | 真正读过、支持结论的来源；不能虚构 |
| experienceBased | boolean | 仅在输入确属个人经验时标记 |
| aiDisclosure | boolean | 助手生成或改写时为 true |

字符计数以当前前后端校验为准。私密随手记使用 content（1–5000 字符）和可选 sourceUrl，不要求分类。不要把长原文静默截断到投稿长度；提炼结论并保留必要上下文。

## 文档与代码定位

| 目的 | 入口 |
| --- | --- |
| 当前状态、开发验证要求 | `docs/START-HERE.md` |
| 当前来源规则 | `docs/product/source-review-policy.md` |
| 人工初审及可见性 | `docs/operations/submission-initial-review.md` |
| 内容编辑目标 | `docs/content-guidelines/knowledge-node.md`（完整模板不是当前表单必填清单） |
| 私密记录 API、权限和重试 | `docs/operations/personal-notes.md` |
| 投稿 UI | `apps/web/src/app/contribute/page.tsx` |
| 随手记 UI | `apps/web/src/app/notes/page.tsx` |
| 首页、候选与详情 | `apps/web/src/app/page.tsx`、`apps/web/src/app/submissions/`、`apps/web/src/app/knowledge/` |
| UI 样式与试读卡 | `apps/web/src/app/styles.css`、`apps/web/src/components/trial-card.tsx` |
| 字段规则 | `packages/content-schema/src/index.ts` |
| 输入类型与 API 客户端 | `packages/contracts/src/index.ts`、`packages/api-client/src/index.ts` |
| 投稿与笔记后端 | `apps/api/src/submissions/`、`apps/api/src/notes/` |
| 数据访问与初始结构 | `packages/database/src/phase1-repository.ts`、`infra/mysql/schema.sql` |
| 部署与备份 | `infra/deployment/README.md`（仅部署任务需要） |

来源规则与初审操作文档是后续调整，应优先于早期 ADR 中已过时的流程描述。发现源码、文档与线上不一致时分别记录，不能直接判定线上行为已修复。

## 验证命令

在源码根目录运行，先读取当时的 package.json 确认脚本仍存在：

```text
pnpm check
pnpm --filter @knowledge-map/web lint
pnpm --filter @knowledge-map/web typecheck
pnpm --filter @knowledge-map/web build
pnpm --filter @knowledge-map/api test
pnpm --filter @knowledge-map/content-schema test
```

后两项按实际改动选择。依赖要求当前为 Node.js 24+、pnpm 11+，完整本地服务依赖 MySQL 和 Redis。纯技能文档变更不需要启动产品、初始化数据库或跑全量应用检查。

## 可选私密记录 API

仅在用户指定 API 路径或明确选择批量效率时使用已有合法凭据；不要为了常规录入自动创建令牌。先读 `docs/operations/personal-notes.md`。

- notes 令牌只管理私密笔记，不能调用投稿、登录或管理员接口。
- `POST /api/notes` 使用 `Idempotency-Key`：同一条记录重试复用同一键，不同记录用不同键；同一键不得搭配变更后的内容。
- 成功必须检查响应并记录 ID。不要把返回令牌、请求认证头或完整私密笔记输出到公共日志或版本库。
