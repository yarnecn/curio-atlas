import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { CONTENT_AI_QUEUE, SOURCE_MAINTENANCE_QUEUE } from '@knowledge-map/contracts';
import { ContentAiProcessor } from './content-ai.processor';
import { ContentAiRecoveryService } from './content-ai-recovery.service';
import { WorkerDatabaseModule } from './database.module';
import { SYSTEM_QUEUE } from './queue.constants';
import { StartupHealthProducer } from './startup-health.producer';
import { SourceMaintenanceService } from './source-maintenance.service';
import { SourceMaintenanceProcessor } from './source-maintenance.processor';
import { SystemProcessor } from './system.processor';

@Module({
  imports: [
    WorkerDatabaseModule,
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number.parseInt(process.env.REDIS_PORT ?? '6379', 10),
      },
      prefix: 'knowledge-map',
    }),
    BullModule.registerQueue(
      { name: SYSTEM_QUEUE },
      { name: CONTENT_AI_QUEUE },
      { name: SOURCE_MAINTENANCE_QUEUE },
    ),
  ],
  providers: [
    StartupHealthProducer,
    SystemProcessor,
    ContentAiProcessor,
    ContentAiRecoveryService,
    SourceMaintenanceService,
    SourceMaintenanceProcessor,
  ],
})
export class WorkerModule {}
