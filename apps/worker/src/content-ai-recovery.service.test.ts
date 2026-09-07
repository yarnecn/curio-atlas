import { describe, expect, it, vi } from 'vitest';
import { SCREEN_SUBMISSION_JOB } from '@knowledge-map/contracts';
import type { Phase1Repository } from '@knowledge-map/database';
import type { Queue } from 'bullmq';
import { ContentAiRecoveryService } from './content-ai-recovery.service';

describe('ContentAiRecoveryService', () => {
  it('re-enqueues durable queued jobs with their database id as the queue id', async () => {
    const repository = {
      listQueuedAiScreeningJobs: vi.fn().mockResolvedValue([
        { aiJobId: 'ai-job-1', submissionId: 'submission-1' },
      ]),
    };
    const queue = { add: vi.fn().mockResolvedValue({ id: 'ai-job-1' }) };
    const service = new ContentAiRecoveryService(
      repository as unknown as Phase1Repository,
      queue as unknown as Queue,
    );

    await service.recover();

    expect(queue.add).toHaveBeenCalledWith(
      SCREEN_SUBMISSION_JOB,
      { submissionId: 'submission-1', aiJobId: 'ai-job-1' },
      expect.objectContaining({ jobId: 'ai-job-1', attempts: 3 }),
    );
  });
});
