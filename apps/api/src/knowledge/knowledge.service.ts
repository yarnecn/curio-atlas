import { Inject, Injectable } from '@nestjs/common';
import type {
  KnowledgeNodeSummary,
  KnowledgeNodeDetail,
  KnowledgeRevisionSummary,
  RollbackKnowledgeInput,
  RollbackKnowledgeResponse,
} from '@knowledge-map/contracts';
import { Phase1Repository } from '@knowledge-map/database';
import { throwRepositoryError } from '../common/repository-errors';

@Injectable()
export class KnowledgeService {
  constructor(@Inject(Phase1Repository) private readonly repository: Phase1Repository) {}

  list(): Promise<KnowledgeNodeSummary[]> {
    return this.repository.listKnowledgeNodes();
  }

  async detail(slug: string): Promise<KnowledgeNodeDetail> {
    try { return await this.repository.getKnowledgeNodeBySlug(slug); }
    catch (error) { return throwRepositoryError(error); }
  }

  async revisions(reviewerId: string, knowledgeNodeId: string): Promise<KnowledgeRevisionSummary[]> {
    try {
      return await this.repository.listKnowledgeRevisions(reviewerId, knowledgeNodeId);
    } catch (error) {
      return throwRepositoryError(error);
    }
  }

  async rollback(
    reviewerId: string,
    knowledgeNodeId: string,
    input: RollbackKnowledgeInput,
  ): Promise<RollbackKnowledgeResponse> {
    try {
      return await this.repository.rollbackKnowledgeRevision(reviewerId, knowledgeNodeId, input);
    } catch (error) {
      return throwRepositoryError(error);
    }
  }
}
