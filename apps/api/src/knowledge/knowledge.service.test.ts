import type { Phase1Repository } from '@knowledge-map/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KnowledgeService } from './knowledge.service';

describe('KnowledgeService', () => {
  const repository = {
    listKnowledgeNodes: vi.fn(),
    listKnowledgeRevisions: vi.fn(),
    rollbackKnowledgeRevision: vi.fn(),
  };
  let service: KnowledgeService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new KnowledgeService(repository as unknown as Phase1Repository);
  });

  it('requires the repository to create a new revision for rollback', async () => {
    const response = {
      knowledgeNodeId: '30000000-0000-4000-8000-000000000001',
      revision: {
        id: '40000000-0000-4000-8000-000000000003',
        knowledgeNodeId: '30000000-0000-4000-8000-000000000001',
        version: 3,
        changeSummary: '恢复上一版内容。',
        reviewStatus: 'published' as const,
        aiInvolvement: 'assisted' as const,
        publishedAt: '2026-09-03T00:00:00.000Z',
        isCurrent: true,
      },
    };
    repository.rollbackKnowledgeRevision.mockResolvedValue(response);

    await expect(service.rollback(
      '00000000-0000-4000-8000-000000000001',
      response.knowledgeNodeId,
      { targetRevisionId: '40000000-0000-4000-8000-000000000001', reason: '恢复上一版内容。' },
    )).resolves.toEqual(response);
    expect(repository.rollbackKnowledgeRevision).toHaveBeenCalledOnce();
  });
});
