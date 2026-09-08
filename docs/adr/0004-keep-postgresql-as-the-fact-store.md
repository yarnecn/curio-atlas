# ADR-0004：继续使用 PostgreSQL 作为事实主库

- 状态：已被 ADR-0005 取代
- 日期：2026-09-03

## 背景

当前已存在 PostgreSQL starter 数据和可运行的内容闭环。实现使用 PostgreSQL 的 `uuid`、`jsonb`、带时区时间、聚合过滤、数据修改 CTE、扩展和特定 Upsert 语义；长期还需要内容关系、全文检索、相似内容检测和可选语义推荐。

## 决策

继续使用 PostgreSQL，当前不把本机 PostgreSQL 未启动的问题转化为一次数据库换型。Redis 继续只承担队列、缓存和短期协调状态。

不建立 PostgreSQL/MySQL 双兼容层。若未来因托管成本、团队能力或既有基础设施必须改用 MySQL，应在正式数据上线前一次性迁移并替换驱动、迁移 SQL、查询、搜索方案和集成测试。

## 原因

- 两者都能满足普通关系数据、事务、JSON 和基础全文检索，MySQL 并非不能实现；
- PostgreSQL 当前更贴合版本化 Block JSON、复杂关系查询和一库起步的内容系统；
- PostgreSQL 可通过 pgvector 在同一事实库内增加向量相似检索，避免首版额外部署向量服务；
- 已完成的迁移、种子和仓储 SQL 均为 PostgreSQL 方言，现在切换会产生重写和重新验收成本，却不增加直接用户价值；
- 低成本部署的主要因素是主机规格、缓存、静态化、备份和运维方式，不是 MySQL 或 PostgreSQL 的名称。

## 可重新评估的条件

- 已确定只能使用 MySQL 的生产托管环境；
- 运维人员只具备 MySQL 可靠备份和恢复能力；
- 明确取消数据库内全文、相似和向量能力，并接受独立搜索服务；
- 切换带来的三年总成本明显低于重写和双系统维护成本。

## 官方能力参考

- [MySQL 8.4 JSON 数据类型](https://dev.mysql.com/doc/refman/8.4/en/json.html)
- [MySQL 8.4 全文检索](https://dev.mysql.com/doc/refman/8.4/en/fulltext-query-expansion.html)
- [MySQL 9.7 向量函数及发行范围说明](https://dev.mysql.com/doc/refman/9.7/en/vector-functions.html)
- [PostgreSQL 当前数据类型与 JSONB](https://www.postgresql.org/docs/current/datatype.html)
- [PostgreSQL 当前全文检索类型](https://www.postgresql.org/docs/current/datatype-textsearch.html)
- [pgvector 官方项目](https://github.com/pgvector/pgvector)
