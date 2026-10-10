# 2026-10-10 依赖安全更新

本次更新 Next.js 16.3.4 → 16.3.8，并在 pnpm-workspace.yaml 中固定已发布的安全补丁版本。
brace-expansion 按原有主版本分别升级，避免把旧 CommonJS 调用方统一切到新版。
webpack-dev-middleware 因旧主版本无修复，升级到 7.4.5；需要验证小程序构建链兼容性。

## 实测结果

- `pnpm install --lockfile-only --ignore-scripts --fetch-retries=0` 成功。
- `pnpm audit --prod --audit-level high` 仍退出 1：3 low、17 moderate、2 high，0 critical。
- `git diff --check` 通过。
- 本地冻结安装因 `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` 中止；未强制清除现有 node_modules，因此尚未完成新版本构建验证。

## 尚未解决的高危项

- `braces <=3.0.3`：GHSA-vfj7-8cjw-p6xm，嵌套模式导致栈耗尽。
- `node-forge <=1.4.0`：GHSA-86w9-cpqp-85rv，RSA 签名验证问题。

截至本次验证，官方 npm registry 没有 braces 3.0.4 和 node-forge 1.4.1；实时审计也返回 Patched versions: None。
两者由小程序 Taro 依赖链引入。不能仅凭依赖用途就认定无风险，也不能将忽略告警描述成修复。
CI 的审计门禁保持不变，本次修改尚不能让整条 CI 通过。

后续需要上游发布补丁，或单独评估维护补丁/替换依赖的兼容性和风险。
安装新依赖后还需运行 Web、小程序构建及测试，再发布镜像和小程序。
