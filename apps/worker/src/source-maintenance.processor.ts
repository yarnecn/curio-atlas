import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import { SCAN_SOURCES_JOB, SOURCE_MAINTENANCE_QUEUE } from '@knowledge-map/contracts';
import type { Job } from 'bullmq';
import { SourceMaintenanceService } from './source-maintenance.service';

@Processor(SOURCE_MAINTENANCE_QUEUE, { concurrency: 1 })
export class SourceMaintenanceProcessor extends WorkerHost {
  constructor(@Inject(SourceMaintenanceService) private readonly maintenance: SourceMaintenanceService) { super(); }

  async process(job: Job): Promise<void> {
    if (job.name !== SCAN_SOURCES_JOB) throw new Error(`Unsupported source job: ${job.name}`);
    await this.maintenance.runOnce();
  }
}
