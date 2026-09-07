import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  CONTENT_AI_QUEUE,
  SCREEN_SUBMISSION_JOB,
  type CreateInternalCandidateInput,
  type CreateSubmissionInput,
  type CreateSubmissionResponse,
  type ReviewSubmissionInput,
  type ReviewSubmissionResponse,
  type SubmissionView,
  type TopicSummary,
  type VoteValue,
} from '@knowledge-map/contracts';
import { Phase1Repository } from '@knowledge-map/database';
import type { Queue } from 'bullmq';
import { throwRepositoryError } from '../common/repository-errors';

@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name);

  constructor(
    @Inject(Phase1Repository) private readonly repository: Phase1Repository,
    @InjectQueue(CONTENT_AI_QUEUE) private readonly aiQueue: Queue,
  ) {}

  async listTopics(): Promise<TopicSummary[]> {
    return this.repository.listTopics();
  }

  async listPublic(): Promise<SubmissionView[]> {
    return this.repository.listSubmissions(['trial', 'expanded_trial', 'queued_for_review'], ['user_submission']);
  }

  async listForReview(reviewerId: string): Promise<SubmissionView[]> {
    try {
      return await this.repository.listReviewQueue(reviewerId);
    } catch (error) {
      return throwRepositoryError(error);
    }
  }

  async get(id: string): Promise<SubmissionView> {
    try {
      return await this.repository.getSubmission(id);
    } catch (error) {
      return throwRepositoryError(error);
    }
  }

  async create(actorId: string, input: CreateSubmissionInput): Promise<CreateSubmissionResponse> {
    try {
      const created = await this.repository.createSubmission(actorId, input);
      await this.enqueueScreening(created.submission.id, created.aiJobId);
      return created;
    } catch (error) {
      return throwRepositoryError(error);
    }
  }

  async createInternal(
    reviewerId: string,
    input: CreateInternalCandidateInput,
  ): Promise<CreateSubmissionResponse> {
    try {
      const created = await this.repository.createInternalCandidate(reviewerId, input);
      await this.enqueueScreening(created.submission.id, created.aiJobId);
      return created;
    } catch (error) {
      return throwRepositoryError(error);
    }
  }

  async vote(actorId: string, submissionId: string, value: VoteValue): Promise<SubmissionView> {
    try {
      return await this.repository.recordVote(actorId, submissionId, value);
    } catch (error) {
      return throwRepositoryError(error);
    }
  }

  async review(
    reviewerId: string,
    submissionId: string,
    input: ReviewSubmissionInput,
  ): Promise<ReviewSubmissionResponse> {
    try {
      return await this.repository.reviewSubmission(reviewerId, submissionId, input);
    } catch (error) {
      return throwRepositoryError(error);
    }
  }

  private async enqueueScreening(submissionId: string, aiJobId: string): Promise<void> {
    try {
      await this.aiQueue.add(
        SCREEN_SUBMISSION_JOB,
        { submissionId, aiJobId },
        {
          jobId: aiJobId,
          attempts: 3,
          backoff: { type: 'exponential', delay: 1_000 },
          removeOnComplete: 100,
          removeOnFail: 100,
        },
      );
    } catch (error) {
      this.logger.error(`Failed to enqueue AI screening job ${aiJobId}.`, error);
    }
  }
}
