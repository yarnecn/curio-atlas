# 投稿初审

用户投稿 → 自动检查 → 人工初审 → 公开尝试池投票 → 达标后正式收录审核。

- 自动检查通过后进入 `queued_for_review`，不直接公开。
- 用户候选没有已批准的 `submission_initial_review` 记录时，`initialReviewRequired` 为 true。审核台只提供初审放行、暂缓、驳回，后端禁止直接收录或合并。
- 初审通过写入审批记录并进入 `trial`；公开列表、详情和投票都检查初审结果。
- 沿用现有状态和审批表，无需新增数据库列。旧尝试池中没有初审记录的用户候选会隐藏，并出现在初审队列；已发布的正式常识不受影响。
- 内部抓取候选仍直接走正式收录审核，不参与公开投票。
- 自动检查发现风险进入 `held`，管理员需要查看风险后决定，不能将规则检查等同于事实核验。

## publicUrl

`server.publicUrl` 当前用于生成 API 的 CORS 允许来源，不控制监听地址、域名解析或 HTTPS 证书。同域网页通过 `/api` 请求，所以误填 localhost 也可能正常访问；这不代表配置正确。

生产环境使用实际域名（例如 `https://atlas.yarne.cc`），并设置 `server.secureCookies: true`。本地 HTTP 调试使用 localhost 和 false。改挂载 JSON 后重启应用即可；小程序 API 地址仍需单独配置。
