import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { SYSTEM_QUEUE } from './queue.constants';

@Processor(SYSTEM_QUEUE)
export class SystemProcessor extends WorkerHost {
  private readonly logger = new Logger(SystemProcessor.name);

  async process(job: Job): Promise<{ processedAt: string }> {
    this.logger.log(`Processed ${job.name} (${job.id ?? 'no-id'}).`);
    return { processedAt: new Date().toISOString() };
  }
}

