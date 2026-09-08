# Curio Atlas 单镜像部署

镜像内包含网站、API、worker 和 Python 抓取器；MySQL 与 Redis 独立保存数据。应用只有一个 JSON 配置文件，不要求设置环境变量。

## 1. 准备配置

复制 `config/app.config.example.json` 为 `config/app.config.json`，至少修改：

- `database.url`：MySQL 8.4 连接地址；
- `redis.host`、`redis.port`；
- `owner.initialPassword`：自己的 10–128 位密码；
- `server.publicUrl`：正式访问地址；
- `server.secureCookies`：使用 HTTPS 时设为 `true`。

容器访问宿主机的 MySQL/Redis 时使用 `host.docker.internal`。Linux 已在 `docker-compose.app.yml` 中配置对应映射。数据库账号至少需要目标数据库内的建表、读写和索引权限；如果数据库尚不存在，还需要建库权限。

## 2. 构建镜像

```bash
npm run image:build
```

生成 `curio-atlas:0.1.0`。

## 3. 启动镜像

```bash
docker compose -f docker-compose.app.yml up -d
```

打开 <http://localhost:8080>，检查：

```bash
docker compose -f docker-compose.app.yml ps
docker compose -f docker-compose.app.yml logs -f app
```

首次启动会自动检查 MySQL 表结构、补齐首版目录和示例内容并初始化站长；以后启动执行同样的幂等检查，不会重复数据，也不会重置已有密码。项目不提供 PostgreSQL 数据转换、数据库迁移或回滚命令。

## 更新版本

先构建新标签，把 `docker-compose.app.yml` 中的镜像标签改成新版本，再重新执行启动命令。MySQL 和 Redis 在应用容器之外，替换镜像不会删除数据。数据库保存结构版本；镜像与结构不兼容时会直接停止，而不是带着错误结构继续运行。升级和生产操作前仍应备份数据库，并按对应版本说明处理结构变化。

## 生产安全底线

- 只向公网开放 80/443，MySQL、Redis 和内部 3000/4000 端口不得公开；
- 使用 HTTPS，并把 `secureCookies` 设为 `true`；
- 配置文件权限仅授予部署账号，禁止提交真实密码和 AI Key；
- `owner.resetPasswordOnStart` 保持 `false`；
- 外部抓取默认关闭，审核来源白名单后再开启；
- 定期备份 MySQL，并实际演练恢复。
