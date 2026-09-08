# Curio Atlas

打开就能看的常识百科：短、完整、可连续阅读。匿名用户可以浏览；投稿、评分和审核使用账号；系统支持来源抓取、AI 整理、人工审核、版本管理和相关常识串联。

## 本地运行

要求：Node.js 24、pnpm 11、MySQL 8.4、Redis。

1. 复制 `config/app.config.example.json` 为 `config/app.config.json`。
2. 把数据库账号、Redis 地址和站长初始密码改成自己的配置。模板已按本机 `localhost` 设置。
3. 运行唯一的启动命令：

```bash
npm start
```

打开 <http://localhost:8080>。停止时按 `Ctrl+C`。

启动过程会自动完成这些工作：构建应用、创建空 MySQL 数据库、检查完整表结构、补齐 12 个领域和 48 个话题、写入 20 篇闭环示例常识、初始化站长账号，然后启动网站、API 和 worker。所有写入均为幂等操作，重复启动不会产生重复内容，也不会重置已有密码。

MySQL 和 Redis 由你自行准备；项目启动不会下载或创建数据库、Redis 容器。

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
