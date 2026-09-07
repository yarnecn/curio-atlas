import { closeDatabasePool, createDatabasePool } from './client.js';
import { Phase1Repository } from './phase1-repository.js';

const password = process.env.BOOTSTRAP_OWNER_PASSWORD;
const publicHandle = process.env.BOOTSTRAP_OWNER_HANDLE ?? 'site-owner';

if (!password || password.length < 10 || password.length > 128) {
  console.error('请临时设置 10-128 位的 BOOTSTRAP_OWNER_PASSWORD，再运行此命令。');
  process.exitCode = 1;
} else {
  const pool = createDatabasePool();
  try {
    const repository = new Phase1Repository(pool);
    if (process.env.BOOTSTRAP_OWNER_ONLY_IF_MISSING === 'true') {
      const result = await repository.ensureOwnerPassword(publicHandle, password);
      console.log(result === 'created'
        ? `站长账号 ${publicHandle} 的初始密码已设置。`
        : `站长账号 ${publicHandle} 已有密码，本次启动保持不变。`);
    } else {
      await repository.bootstrapOwnerPassword(publicHandle, password);
      console.log(`站长账号 ${publicHandle} 的登录密码已设置；现有会话已失效。`);
    }
  } finally {
    await closeDatabasePool(pool);
  }
}
