import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SourceMaintenanceService } from './source-maintenance.service';
import { WorkerModule } from './worker.module';

async function run(): Promise<void> {
  process.env.SOURCE_ONCE_MODE = 'true';
  const app = await NestFactory.createApplicationContext(WorkerModule, { logger: ['error', 'warn', 'log'] });
  try {
    Logger.log('开始执行一轮白名单来源扫描与候选生成。', 'SourceOnce');
    const result = await app.get(SourceMaintenanceService).runOnce();
    Logger.log(
      `本轮完成：检查 ${result.scannedSources} 个来源，新增 ${result.newEvidencePackages} 个证据包，处理 ${result.processedEvidencePackages} 个证据候选。`,
      'SourceOnce',
    );
    Logger.log('可到 /admin/operations 查看证据，到 /admin/review 审核候选。', 'SourceOnce');
  } finally {
    await app.close();
  }
}

void run().catch((error: unknown) => {
  Logger.error(error instanceof Error ? error.message : String(error), undefined, 'SourceOnce');
  process.exitCode = 1;
});
