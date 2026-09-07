import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { CONTENT_AI_QUEUE, SCREEN_SUBMISSION_JOB } from '@knowledge-map/contracts';
import { Phase1Repository } from '@knowledge-map/database';
import type { Job } from 'bullmq';
import { runAiScreening } from './ai-adapter';
export { screenSubmission } from './ai-adapter';

interface ScreenSubmissionJob {
  submissionId: string;
  aiJobId: string;
}

@Processor(CONTENT_AI_QUEUE, { concurrency: 1 })
export class ContentAiProcessor extends WorkerHost {
  private readonly logger = new Logger(ContentAiProcessor.name);

  constructor(@Inject(Phase1Repository) private readonly repository: Phase1Repository) {
    super();
  }

  async process(job: Job<ScreenSubmissionJob>): Promise<{ status: string }> {
    if (job.name !== SCREEN_SUBMISSION_JOB) throw new Error(`Unsupported content AI job: ${job.name}`);
    const { submissionId, aiJobId } = job.data;
    try {
      await this.repository.startAiScreening(aiJobId);
      const revision = await this.repository.getCurrentSubmissionRevision(submissionId);
      const config = await this.repository.getAiRuntimeConfig();
      const result = await runAiScreening(config, revision);
      await this.repository.completeAiScreening(aiJobId, submissionId, result);
      this.logger.log(`Screened submission ${submissionId}.`);
      return { status: 'completed' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.repository.failAiScreening(aiJobId, message);
      throw error;
    }
  }
}
