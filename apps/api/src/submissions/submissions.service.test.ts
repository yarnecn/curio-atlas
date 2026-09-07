import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CONTENT_AI_QUEUE, SCREEN_SUBMISSION_JOB } from '@knowledge-map/contracts';
import type { Phase1Repository } from '@knowledge-map/database';
import type { Queue } from 'bullmq';
import { SubmissionsService } from './submissions.service';

const createdSubmission = {
  id: '50000000-0000-4000-8000-000000000099',
  authorHandle: 'pine-42',
  originType: 'user_submission' as const,
  triggerReason: null,
  proposedTitle: null,
  proposedSlug: null,
  topic: {
    id: '20000000-0000-4000-8000-000000000001',
    slug: 'world-geography',
    name: '世界地理骨架',
    domainName: '地理',
    v1TargetCount: 35,
  },
  status: 'automated_screening' as const,
  statement: '天气描述短期大气状态，气候描述长期统计特征。',
  displayStatement: '天气描述短期大气状态，气候描述长期统计特征。',
  whyUseful: '区分两者有助于理解日常天气和长期气候资料。',
  applicability: '适用于阅读天气预报和气候资料。',
  sourceUrl: 'https://example.com/source',
  experienceBased: false,
  aiDisclosure: false,
  aiRiskFlags: [],
  usefulCount: 0,
  notUsefulCount: 0,
  validVoteCount: 0,
  usefulnessRate: 0,
  createdAt: '2026-09-03T00:00:00.000Z',
  updatedAt: '2026-09-03T00:00:00.000Z',
};

describe('SubmissionsService', () => {
  const repository = {
    createSubmission: vi.fn(),
    createInternalCandidate: vi.fn(),
  };
  const queue = {
    add: vi.fn(),
  };
  let service: SubmissionsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SubmissionsService(
      repository as unknown as Phase1Repository,
      queue as unknown as Queue,
    );
  });

  it('persists a candidate before enqueueing its AI screening job', async () => {
    repository.createSubmission.mockResolvedValue({ submission: createdSubmission, aiJobId: 'ai-job-1' });
    queue.add.mockResolvedValue({ id: 'ai-job-1' });

    const result = await service.create('00000000-0000-4000-8000-000000000002', {
      topicId: createdSubmission.topic.id,
      statement: createdSubmission.statement,
      whyUseful: createdSubmission.whyUseful,
      applicability: createdSubmission.applicability,
      sourceUrl: createdSubmission.sourceUrl,
      experienceBased: false,
      aiDisclosure: false,
    });

    expect(result.aiJobId).toBe('ai-job-1');
    expect(queue.add).toHaveBeenCalledWith(
      SCREEN_SUBMISSION_JOB,
      { submissionId: createdSubmission.id, aiJobId: 'ai-job-1' },
      expect.objectContaining({ jobId: 'ai-job-1', attempts: 3 }),
    );
    expect(CONTENT_AI_QUEUE).toBe('content-ai');
  });

  it('returns the persisted candidate if Redis is temporarily unavailable', async () => {
    repository.createSubmission.mockResolvedValue({ submission: createdSubmission, aiJobId: 'ai-job-2' });
    queue.add.mockRejectedValue(new Error('redis unavailable'));

    await expect(service.create('00000000-0000-4000-8000-000000000002', {
      topicId: createdSubmission.topic.id,
      statement: createdSubmission.statement,
      whyUseful: createdSubmission.whyUseful,
      applicability: createdSubmission.applicability,
      sourceUrl: createdSubmission.sourceUrl,
      experienceBased: false,
      aiDisclosure: false,
    })).resolves.toEqual({ submission: createdSubmission, aiJobId: 'ai-job-2' });
  });

  it('enqueues an internal editorial candidate through the same durable AI job path', async () => {
    const internal = {
      ...createdSubmission,
      originType: 'coverage_gap' as const,
      triggerReason: '常识覆盖地图发现缺口。',
      proposedTitle: '天气与气候',
      proposedSlug: 'weather-and-climate',
    };
    repository.createInternalCandidate.mockResolvedValue({ submission: internal, aiJobId: 'ai-job-3' });
    queue.add.mockResolvedValue({ id: 'ai-job-3' });

    await expect(service.createInternal('00000000-0000-4000-8000-000000000001', {
      topicId: internal.topic.id,
      proposedTitle: internal.proposedTitle,
      proposedSlug: internal.proposedSlug,
      statement: internal.statement,
      whyUseful: internal.whyUseful,
      applicability: internal.applicability,
      sourceUrl: internal.sourceUrl ?? '',
      originType: 'coverage_gap',
      triggerReason: internal.triggerReason,
      aiDisclosure: true,
    })).resolves.toEqual({ submission: internal, aiJobId: 'ai-job-3' });

    expect(repository.createInternalCandidate).toHaveBeenCalledOnce();
    expect(queue.add).toHaveBeenCalledWith(
      SCREEN_SUBMISSION_JOB,
      { submissionId: internal.id, aiJobId: 'ai-job-3' },
      expect.objectContaining({ jobId: 'ai-job-3' }),
    );
  });
});
