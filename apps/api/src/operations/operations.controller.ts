import { Body, Controller, Get, Headers, Inject, Param, Patch, Post, Put } from '@nestjs/common';
import {
  createKnowledgeDomainSchema,
  bulkCreateSourceFeedsSchema,
  createSourceFeedSchema,
  createTopicSchema,
  updateAiRuntimeConfigSchema,
  updateKnowledgeDomainSchema,
  updateSourceFeedSchema,
  updateTopicSchema,
} from '@knowledge-map/content-schema';
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
import { AuthService } from '../auth/auth.service';
import { parseBody } from '../common/request-validation';
import { OperationsService } from './operations.service';

@Controller('admin/operations')
export class OperationsController {
  constructor(
    @Inject(OperationsService) private readonly operations: OperationsService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  private async actorId(cookie: string | undefined): Promise<string> {
    return (await this.auth.requireUser(cookie)).id;
  }

  @Get('taxonomy')
  async taxonomy(@Headers('cookie') cookie: string | undefined): Promise<TaxonomyAdminView> {
    return this.operations.taxonomy(await this.actorId(cookie));
  }

  @Post('domains')
  async createDomain(@Headers('cookie') cookie: string | undefined, @Body() body: unknown): Promise<TaxonomyAdminView> {
    return this.operations.createDomain(
      await this.actorId(cookie),
      parseBody<CreateKnowledgeDomainInput>(createKnowledgeDomainSchema, body),
    );
  }

  @Patch('domains/:id')
  async updateDomain(
    @Headers('cookie') cookie: string | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<TaxonomyAdminView> {
    return this.operations.updateDomain(
      await this.actorId(cookie), id, parseBody<UpdateKnowledgeDomainInput>(updateKnowledgeDomainSchema, body),
    );
  }

  @Post('topics')
  async createTopic(@Headers('cookie') cookie: string | undefined, @Body() body: unknown): Promise<TaxonomyAdminView> {
    return this.operations.createTopic(await this.actorId(cookie), parseBody<CreateTopicInput>(createTopicSchema, body));
  }

  @Patch('topics/:id')
  async updateTopic(
    @Headers('cookie') cookie: string | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<TaxonomyAdminView> {
    return this.operations.updateTopic(await this.actorId(cookie), id, parseBody<UpdateTopicInput>(updateTopicSchema, body));
  }

  @Get('ai-runtime')
  async aiRuntime(@Headers('cookie') cookie: string | undefined): Promise<AiRuntimeConfigView> {
    return this.operations.aiRuntime(await this.actorId(cookie));
  }

  @Put('ai-runtime')
  async updateAiRuntime(
    @Headers('cookie') cookie: string | undefined,
    @Body() body: unknown,
  ): Promise<AiRuntimeConfigView> {
    return this.operations.updateAiRuntime(
      await this.actorId(cookie), parseBody<UpdateAiRuntimeConfigInput>(updateAiRuntimeConfigSchema, body),
    );
  }

  @Get('sources')
  async sources(@Headers('cookie') cookie: string | undefined): Promise<SourceOperationsView> {
    return this.operations.sources(await this.actorId(cookie));
  }

  @Post('sources')
  async createSource(@Headers('cookie') cookie: string | undefined, @Body() body: unknown): Promise<SourceOperationsView> {
    return this.operations.createSource(await this.actorId(cookie), parseBody<CreateSourceFeedInput>(createSourceFeedSchema, body));
  }

  @Post('sources/bulk')
  async createSourcesBulk(
    @Headers('cookie') cookie: string | undefined,
    @Body() body: unknown,
  ): Promise<BulkSourceImportResponse> {
    return this.operations.createSourcesBulk(
      await this.actorId(cookie), parseBody<BulkCreateSourceFeedsInput>(bulkCreateSourceFeedsSchema, body),
    );
  }

  @Patch('sources/:id')
  async updateSource(
    @Headers('cookie') cookie: string | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<SourceOperationsView> {
    return this.operations.updateSource(
      await this.actorId(cookie), id, parseBody<UpdateSourceFeedInput>(updateSourceFeedSchema, body),
    );
  }

  @Post('sources/:id/scan')
  async scanSource(@Headers('cookie') cookie: string | undefined, @Param('id') id: string): Promise<SourceOperationsView> {
    return this.operations.scanSourceNow(await this.actorId(cookie), id);
  }
}
