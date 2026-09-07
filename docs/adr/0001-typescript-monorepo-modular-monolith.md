# ADR-0001：TypeScript Monorepo 与模块化单体

- 状态：已接受
- 日期：2026-09-02

## 背景

首版同时包含网站、小程序、API 和后台任务，团队规模小，内容模型仍需通过真实节点迭代。此时过早拆分服务会增加契约、部署、数据一致性和可观测性成本。

## 决策

使用 pnpm workspace + Turborepo 管理 TypeScript Monorepo。网站采用 Next.js App Router，小程序采用 Taro + React，API 采用 NestJS REST，worker 采用 NestJS standalone + BullMQ。业务能力在同一 API 内按模块边界组织，共用一个 PostgreSQL 数据库。

共享代码只进入职责明确的包：契约、内容 Schema、纯领域规则、API 客户端、设计变量、配置和测试夹具。应用不能通过跨目录相对路径互相引用。

## 结果

好处是本地启动、原子变更、类型共享和 CI 更简单；代价是必须主动维护模块边界，并避免把所有代码堆进无边界的 `shared` 包。

未来只有在独立扩缩容、故障隔离、合规隔离或团队所有权形成真实需求时，才把模块拆为服务。拆分前通过 Adapter 和模块公共接口降低耦合。

