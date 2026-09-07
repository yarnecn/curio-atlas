import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { HealthService } from './health/health.service';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { OperationsModule } from './operations/operations.module';
import { SubmissionsModule } from './submissions/submissions.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number.parseInt(process.env.REDIS_PORT ?? '6379', 10),
      },
      prefix: 'knowledge-map',
    }),
    SubmissionsModule,
    KnowledgeModule,
    OperationsModule,
  ],
  controllers: [HealthController],
  providers: [HealthService],
})
export class AppModule {}
