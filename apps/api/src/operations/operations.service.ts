import { Inject, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { SCAN_SOURCES_JOB, SOURCE_MAINTENANCE_QUEUE } from '@knowledge-map/contracts';
import type {
  AiRuntimeConfigView,
  BulkCreateSourceFeedsInput,
  BulkSourceImportResponse,
  CreateKnowledgeDomainInput,
  CreateSourceFeedInput,
  CreateTopicInput,
  TaxonomyAdminView,
  SourceOperationsView,
  UpdateAiRuntimeConfigInput,
  UpdateKnowledgeDomainInput,
  UpdateSourceFeedInput,
  UpdateTopicInput,
} from '@knowledge-map/contracts';
import type { Queue } from 'bullmq';
import { Phase1Repository } from '@knowledge-map/database';
import { throwRepositoryError } from '../common/repository-errors';

@Injectable()
export class OperationsService {
  constructor(
    @Inject(Phase1Repository) private readonly repository: Phase1Repository,
    @InjectQueue(SOURCE_MAINTENANCE_QUEUE) private readonly sourceQueue: Queue,
  ) {}

  async taxonomy(actorId: string): Promise<TaxonomyAdminView> {
    try { return await this.repository.listTaxonomy(actorId); } catch (error) { return throwRepositoryError(error); }
  }

  async createDomain(actorId: string, input: CreateKnowledgeDomainInput): Promise<TaxonomyAdminView> {
    try {
      await this.repository.createKnowledgeDomain(actorId, input);
      return await this.repository.listTaxonomy(actorId);
    } catch (error) { return throwRepositoryError(error); }
  }

  async updateDomain(actorId: string, id: string, input: UpdateKnowledgeDomainInput): Promise<TaxonomyAdminView> {
    try {
      await this.repository.updateKnowledgeDomain(actorId, id, input);
      return await this.repository.listTaxonomy(actorId);
    } catch (error) { return throwRepositoryError(error); }
  }

  async createTopic(actorId: string, input: CreateTopicInput): Promise<TaxonomyAdminView> {
    try {
      await this.repository.createTopic(actorId, input);
      return await this.repository.listTaxonomy(actorId);
    } catch (error) { return throwRepositoryError(error); }
  }

  async updateTopic(actorId: string, id: string, input: UpdateTopicInput): Promise<TaxonomyAdminView> {
    try {
      await this.repository.updateTopic(actorId, id, input);
      return await this.repository.listTaxonomy(actorId);
    } catch (error) { return throwRepositoryError(error); }
  }

  async aiRuntime(actorId: string): Promise<AiRuntimeConfigView> {
    await this.repository.listTaxonomy(actorId);
    return this.describeAiConfig(await this.repository.getAiRuntimeConfig());
  }

  async updateAiRuntime(actorId: string, input: UpdateAiRuntimeConfigInput): Promise<AiRuntimeConfigView> {
    try {
      await this.repository.updateAiRuntimeConfig(actorId, input);
      return this.describeAiConfig(await this.repository.getAiRuntimeConfig());
    } catch (error) { return throwRepositoryError(error); }
  }

  private describeAiConfig(config: AiRuntimeConfigView): AiRuntimeConfigView {
    const descriptions = {
      rules: '零 Token 规则模式：只做格式清理和基础风险检查。',
      ollama: '本地模型模式：模型在自己的电脑或服务器运行，不按 Token 付费。',
      openai_compatible: '远程兼容接口：使用服务器配置文件中的密钥，费用由所选供应商决定。',
    } as const;
    return { ...config, modeDescription: descriptions[config.provider] };
  }

  async sources(actorId: string): Promise<SourceOperationsView> {
    try { return await this.repository.listSourceOperations(actorId); } catch (error) { return throwRepositoryError(error); }
  }

  async createSource(actorId: string, input: CreateSourceFeedInput): Promise<SourceOperationsView> {
    try {
      await this.repository.createSourceFeed(actorId, input);
      return await this.repository.listSourceOperations(actorId);
    } catch (error) { return throwRepositoryError(error); }
  }

  async createSourcesBulk(actorId: string, input: BulkCreateSourceFeedsInput): Promise<BulkSourceImportResponse> {
    try {
      const counts = await this.repository.createSourceFeedsBulk(actorId, input);
      return { ...await this.repository.listSourceOperations(actorId), ...counts };
    } catch (error) { return throwRepositoryError(error); }
  }

  async updateSource(actorId: string, id: string, input: UpdateSourceFeedInput): Promise<SourceOperationsView> {
    try {
      await this.repository.updateSourceFeed(actorId, id, input);
      return await this.repository.listSourceOperations(actorId);
    } catch (error) { return throwRepositoryError(error); }
  }

  async scanSourceNow(actorId: string, id: string): Promise<SourceOperationsView> {
    try {
      await this.repository.scheduleSourceFeedNow(actorId, id);
      await this.sourceQueue.add(SCAN_SOURCES_JOB, {}, {
        jobId: `manual-${id}-${Date.now()}`,
        removeOnComplete: 100,
        removeOnFail: 100,
      });
      return await this.repository.listSourceOperations(actorId);
    } catch (error) { return throwRepositoryError(error); }
  }
}
