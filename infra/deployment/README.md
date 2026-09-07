# 单镜像部署与升级

网站、API、worker 和 Python 抓取器已经打进同一个 `knowledge-map` 镜像。容器只开放一个端口；PostgreSQL 和 Redis 作为外部数据服务，更新镜像不会丢数据。

## 1. 准备数据服务

- PostgreSQL 15+
- Redis 7+
- 一台能运行 Linux 容器的 Docker 主机

数据库和 Redis 可以在宿主机、其他容器或云数据库中。应用镜像不会在内部再启动一份数据库。

## 2. 准备唯一配置文件

复制 `config/app.config.example.json` 为 `config/app.config.json`，至少修改：

- `database.url`
- `redis.host` / `redis.port`
- `owner.initialPassword`
- `server.publicUrl`
- 远程 AI 模式需要填写 `ai.apiKey`

`app.config.json` 被 Git 和 Docker 构建上下文忽略，不会写进镜像。正式域名启用 HTTPS 后，将 `server.publicUrl` 改成正式地址，并把 `server.secureCookies` 改为 `true`。

`owner.initialPassword` 默认只在数据库尚无站长密码时使用。忘记密码时可将 `owner.resetPasswordOnStart` 临时改为 `true` 并重启一次，成功后必须改回 `false`，否则每次重启都会重置密码并注销旧会话。

全部运行参数如下；没有第二份环境变量清单：

| 配置 | 用途 |
| --- | --- |
| `server.port` | 容器内统一端口，通常保持 `8080` |
| `server.publicUrl` | 浏览器实际访问地址；本机可用 `http://localhost:8080`，正式环境填 HTTPS 域名 |
| `server.secureCookies` | HTTPS 时设为 `true`；纯 HTTP 本机测试设为 `false` |
| `database.url` | PostgreSQL 连接地址；密码中的特殊字符需要 URL 编码 |
| `database.poolMax` | 单进程数据库连接上限，小服务器建议 `5` |
| `database.migrateOnStart` | 启动前自动执行未运行的迁移，建议保持 `true` |
| `database.seedStarterOnFirstStart` | 幂等写入首版目录和内容，多次启动不会重复 |
| `redis.host` / `redis.port` | Redis 地址；同一 Docker 网络时填 Redis 服务名 |
| `owner.handle` | 站长登录名，3—32 位小写字母、数字、下划线或连字符 |
| `owner.initialPassword` | 首次密码，10—128 位；已有密码时默认不覆盖 |
| `owner.resetPasswordOnStart` | 仅找回站长密码时临时设为 `true` |
| `worker.aiJobRecoverySeconds` | 异步任务恢复检查周期 |
| `ai.apiKey` | 远程 OpenAI 兼容接口密钥；规则模式和本地 Ollama 可留空 |
| `sources.automationEnabled` | 全站自动来源维护总开关，不影响后台“立即抓取” |
| `sources.scanIntervalMinutes` | worker 查找待抓来源的周期 |
| `sources.scanBatchSize` / `draftBatchSize` | 每批抓取来源数 / 每批生成候选数 |
| `sources.fetchTimeoutSeconds` | 每个页面的超时秒数 |
| `sources.maxResponseBytes` | 每个页面允许读取的最大字节数 |
| `sources.pythonExecutable` | 镜像内固定为 `/usr/bin/python3`，通常不要修改 |

配置文件包含数据库密码和 AI 密钥，宿主机上应只允许部署账号读取。JSON 不支持注释；拼写、类型或必填值错误时，容器会直接报出具体字段并停止启动。

## 3. 构建镜像

```bash
docker build --build-arg APP_VERSION=0.1.0 -t knowledge-map:0.1.0 .
```

镜像使用多阶段构建，最终层只包含生产依赖、构建产物、Python 和启动器，不包含 TypeScript 编译工具。镜像默认以非 root 用户运行。

如需同时支持 AMD64 和 ARM64，可发布到自己的镜像仓库：

```bash
docker buildx build --platform linux/amd64,linux/arm64 \
  --build-arg APP_VERSION=0.1.0 \
  -t 你的仓库/knowledge-map:0.1.0 --push .
```

## 4. 启动

```bash
docker run -d \
  --name knowledge-map \
  --restart unless-stopped \
  --add-host host.docker.internal:host-gateway \
  -p 8080:8080 \
  -v "$PWD/config/app.config.json:/app/config/app.config.json:ro" \
  knowledge-map:0.1.0
```

也可修改 `docker-compose.app.yml` 中的镜像标签后运行：

```bash
docker compose -f docker-compose.app.yml up -d
```

启动器会依次执行数据库迁移、幂等种子、仅首次初始化站长密码，再启动 Web、API 和 worker。

- 网站：`http://服务器:8080`
- 健康检查：`http://服务器:8080/healthz`
- API：同域 `/api`，不额外开放端口

## 5. 升级版本

构建或拉取新标签后，只修改镜像版本并重建容器：

```bash
docker pull 你的仓库/knowledge-map:0.2.0
docker stop knowledge-map
docker rm knowledge-map
docker run -d \
  --name knowledge-map \
  --restart unless-stopped \
  --add-host host.docker.internal:host-gateway \
  -p 8080:8080 \
  -v "$PWD/config/app.config.json:/app/config/app.config.json:ro" \
  你的仓库/knowledge-map:0.2.0
```

配置、PostgreSQL 和 Redis 保持不变。新镜像启动时自动执行未运行的迁移；升级前仍应备份 PostgreSQL。

## 6. 修改配置

编辑宿主机上的 `config/app.config.json`，然后运行：

```bash
docker restart knowledge-map
```

配置只在启动时读取，避免半运行状态下多个进程使用不同版本。管理员后来在管理台选择的 AI 模型和地址保存在数据库；AI 密钥只保存在配置文件。

## 7. 反向代理

Nginx/Caddy 只需把正式域名转发到 `127.0.0.1:8080`。生产必须启用 HTTPS，不要向公网开放 PostgreSQL、Redis或容器内部 3000/4000 端口。

上线前还要完成：限流、备份恢复演练、管理员多因素认证、找回密码和投稿合规核对。
