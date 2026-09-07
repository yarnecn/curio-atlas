import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { CONTENT_AI_QUEUE, SCREEN_SUBMISSION_JOB } from '@knowledge-map/contracts';
import { Phase1Repository } from '@knowledge-map/database';
import type { Queue } from 'bullmq';

@Injectable()
export class ContentAiRecoveryService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(ContentAiRecoveryService.name);
  private timer: NodeJS.Timeout | undefined;

  constructor(
    @Inject(Phase1Repository) private readonly repository: Phase1Repository,
    @InjectQueue(CONTENT_AI_QUEUE) private readonly queue: Queue,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.recover();
    const intervalMs = Number.parseInt(process.env.AI_JOB_RECOVERY_INTERVAL_MS ?? '30000', 10);
    this.timer = setInterval(() => void this.recover(), intervalMs);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async recover(): Promise<void> {
    try {
      const jobs = await this.repository.listQueuedAiScreeningJobs();
      for (const job of jobs) {
        await this.queue.add(
          SCREEN_SUBMISSION_JOB,
          { submissionId: job.submissionId, aiJobId: job.aiJobId },
          {
            jobId: job.aiJobId,
            attempts: 3,
            backoff: { type: 'exponential', delay: 1_000 },
            removeOnComplete: 100,
            removeOnFail: 100,
          },
        );
      }
      if (jobs.length > 0) this.logger.log(`Recovered ${jobs.length} queued AI screening job(s).`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`AI job recovery will retry later: ${message}`);
    }
  }
}
