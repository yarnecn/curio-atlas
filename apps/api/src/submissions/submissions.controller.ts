import { Body, Controller, Get, Headers, Inject, Param, Post, Put } from '@nestjs/common';
import {
  createInternalCandidateSchema,
  createSubmissionSchema,
  reviewSubmissionSchema,
  voteSchema,
} from '@knowledge-map/content-schema';
import type {
  CreateInternalCandidateInput,
  CreateSubmissionInput,
  CreateSubmissionResponse,
  ReviewSubmissionInput,
  ReviewSubmissionResponse,
  SubmissionView,
  TopicSummary,
  VoteInput,
} from '@knowledge-map/contracts';
import { AuthService } from '../auth/auth.service';
import { parseBody } from '../common/request-validation';
import { SubmissionsService } from './submissions.service';

@Controller()
export class SubmissionsController {
  constructor(
    @Inject(SubmissionsService) private readonly submissions: SubmissionsService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  @Get('topics')
  listTopics(): Promise<TopicSummary[]> {
    return this.submissions.listTopics();
  }

  @Get('submissions')
  listPublic(): Promise<SubmissionView[]> {
    return this.submissions.listPublic();
  }

  @Get('submissions/:id')
  get(@Param('id') id: string): Promise<SubmissionView> {
    return this.submissions.get(id);
  }

  @Post('submissions')
  async create(
    @Headers('cookie') cookie: string | undefined,
    @Body() body: unknown,
  ): Promise<CreateSubmissionResponse> {
    const actorId = (await this.auth.requireUser(cookie)).id;
    const input = parseBody<CreateSubmissionInput>(createSubmissionSchema, body);
    return this.submissions.create(actorId, input);
  }

  @Put('submissions/:id/vote')
  async vote(
    @Headers('cookie') cookie: string | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<SubmissionView> {
    const actorId = (await this.auth.requireUser(cookie)).id;
    const input = parseBody<VoteInput>(voteSchema, body);
    return this.submissions.vote(actorId, id, input.value);
  }

  @Get('admin/review/submissions')
  async listForReview(@Headers('cookie') cookie: string | undefined): Promise<SubmissionView[]> {
    return this.submissions.listForReview((await this.auth.requireUser(cookie)).id);
  }

  @Post('admin/editorial-candidates')
  async createInternal(
    @Headers('cookie') cookie: string | undefined,
    @Body() body: unknown,
  ): Promise<CreateSubmissionResponse> {
    const reviewerId = (await this.auth.requireUser(cookie)).id;
    const input = parseBody<CreateInternalCandidateInput>(createInternalCandidateSchema, body);
    return this.submissions.createInternal(reviewerId, input);
  }

  @Post('admin/review/submissions/:id/decision')
  async review(
    @Headers('cookie') cookie: string | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<ReviewSubmissionResponse> {
    const reviewerId = (await this.auth.requireUser(cookie)).id;
    const input = parseBody<ReviewSubmissionInput>(reviewSubmissionSchema, body);
    return this.submissions.review(reviewerId, id, input);
  }
}
