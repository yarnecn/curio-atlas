import { Body, Controller, Get, Headers, Inject, Param, Post } from '@nestjs/common';
import { rollbackKnowledgeSchema } from '@knowledge-map/content-schema';
import type {
  KnowledgeNodeSummary,
  KnowledgeNodeDetail,
  KnowledgeRevisionSummary,
  RollbackKnowledgeInput,
  RollbackKnowledgeResponse,
} from '@knowledge-map/contracts';
import { AuthService } from '../auth/auth.service';
import { parseBody } from '../common/request-validation';
import { KnowledgeService } from './knowledge.service';

@Controller('knowledge')
export class KnowledgeController {
  constructor(
    @Inject(KnowledgeService) private readonly knowledge: KnowledgeService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  @Get()
  list(): Promise<KnowledgeNodeSummary[]> {
    return this.knowledge.list();
  }

  @Get('slug/:slug')
  detail(@Param('slug') slug: string): Promise<KnowledgeNodeDetail> {
    return this.knowledge.detail(slug);
  }

  @Get(':id/revisions')
  async revisions(
    @Headers('cookie') cookie: string | undefined,
    @Param('id') id: string,
  ): Promise<KnowledgeRevisionSummary[]> {
    return this.knowledge.revisions((await this.auth.requireUser(cookie)).id, id);
  }

  @Post(':id/rollback')
  async rollback(
    @Headers('cookie') cookie: string | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<RollbackKnowledgeResponse> {
    const input = parseBody<RollbackKnowledgeInput>(rollbackKnowledgeSchema, body);
    return this.knowledge.rollback((await this.auth.requireUser(cookie)).id, id, input);
  }
}
