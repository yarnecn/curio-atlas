import type {
  AiRuntimeConfigView,
  AuthStateView,
  BulkCreateSourceFeedsInput,
  BulkSourceImportResponse,
  CreateKnowledgeDomainInput,
  CreateSourceFeedInput,
  CreateInternalCandidateInput,
  CreateSubmissionInput,
  CreateSubmissionResponse,
  CreateTopicInput,
  HealthResponse,
  KnowledgeNodeSummary,
  KnowledgeNodeDetail,
  KnowledgeRevisionSummary,
  LoginInput,
  RegisterAccountInput,
  ReviewSubmissionInput,
  ReviewSubmissionResponse,
  RollbackKnowledgeInput,
  RollbackKnowledgeResponse,
  SubmissionView,
  SourceOperationsView,
  TaxonomyAdminView,
  TopicSummary,
  UpdateAiRuntimeConfigInput,
  UpdateKnowledgeDomainInput,
  UpdateSourceFeedInput,
  UpdateTopicInput,
  VoteInput,
} from '@knowledge-map/contracts';

export interface ApiClientOptions {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
}

export function createApiClient(options: ApiClientOptions) {
  const request = options.fetch ?? globalThis.fetch;
  const baseUrl = options.baseUrl.replace(/\/$/, '');

  async function json<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('accept', 'application/json');
    if (init.body) headers.set('content-type', 'application/json');
    const response = await request(`${baseUrl}${path}`, { credentials: 'include', ...init, headers });
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { message?: string | string[] } | null;
      const message = Array.isArray(payload?.message) ? payload.message.join('；') : payload?.message;
      throw new Error(message ?? `API request failed: ${response.status}`);
    }
    return (await response.json()) as T;
  }

  return {
    health: (): Promise<HealthResponse> => json<HealthResponse>('/health'),
    authState: (): Promise<AuthStateView> => json<AuthStateView>('/auth/me'),
    register: (input: RegisterAccountInput): Promise<AuthStateView> =>
      json<AuthStateView>('/auth/register', { method: 'POST', body: JSON.stringify(input) }),
    login: (input: LoginInput): Promise<AuthStateView> =>
      json<AuthStateView>('/auth/login', { method: 'POST', body: JSON.stringify(input) }),
    logout: (): Promise<AuthStateView> => json<AuthStateView>('/auth/logout', { method: 'POST' }),
    topics: (): Promise<TopicSummary[]> => json<TopicSummary[]>('/topics'),
    submissions: (): Promise<SubmissionView[]> => json<SubmissionView[]>('/submissions'),
    createSubmission: (input: CreateSubmissionInput): Promise<CreateSubmissionResponse> =>
      json<CreateSubmissionResponse>('/submissions', { method: 'POST', body: JSON.stringify(input) }),
    createInternalCandidate: (input: CreateInternalCandidateInput): Promise<CreateSubmissionResponse> =>
      json<CreateSubmissionResponse>('/admin/editorial-candidates', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    vote: (submissionId: string, input: VoteInput): Promise<SubmissionView> =>
      json<SubmissionView>(`/submissions/${submissionId}/vote`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    reviewQueue: (): Promise<SubmissionView[]> => json<SubmissionView[]>('/admin/review/submissions'),
    reviewSubmission: (
      submissionId: string,
      input: ReviewSubmissionInput,
    ): Promise<ReviewSubmissionResponse> =>
      json<ReviewSubmissionResponse>(`/admin/review/submissions/${submissionId}/decision`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    knowledgeNodes: (): Promise<KnowledgeNodeSummary[]> => json<KnowledgeNodeSummary[]>('/knowledge'),
    knowledgeNode: (slug: string): Promise<KnowledgeNodeDetail> =>
      json<KnowledgeNodeDetail>(`/knowledge/slug/${encodeURIComponent(slug)}`),
    knowledgeRevisions: (knowledgeNodeId: string): Promise<KnowledgeRevisionSummary[]> =>
      json<KnowledgeRevisionSummary[]>(`/knowledge/${knowledgeNodeId}/revisions`),
    rollbackKnowledge: (
      knowledgeNodeId: string,
      input: RollbackKnowledgeInput,
    ): Promise<RollbackKnowledgeResponse> =>
      json<RollbackKnowledgeResponse>(`/knowledge/${knowledgeNodeId}/rollback`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    taxonomy: (): Promise<TaxonomyAdminView> => json<TaxonomyAdminView>('/admin/operations/taxonomy'),
    createDomain: (input: CreateKnowledgeDomainInput): Promise<TaxonomyAdminView> =>
      json<TaxonomyAdminView>('/admin/operations/domains', { method: 'POST', body: JSON.stringify(input) }),
    updateDomain: (id: string, input: UpdateKnowledgeDomainInput): Promise<TaxonomyAdminView> =>
      json<TaxonomyAdminView>(`/admin/operations/domains/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
    createTopic: (input: CreateTopicInput): Promise<TaxonomyAdminView> =>
      json<TaxonomyAdminView>('/admin/operations/topics', { method: 'POST', body: JSON.stringify(input) }),
    updateTopic: (id: string, input: UpdateTopicInput): Promise<TaxonomyAdminView> =>
      json<TaxonomyAdminView>(`/admin/operations/topics/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
    aiRuntime: (): Promise<AiRuntimeConfigView> => json<AiRuntimeConfigView>('/admin/operations/ai-runtime'),
    updateAiRuntime: (input: UpdateAiRuntimeConfigInput): Promise<AiRuntimeConfigView> =>
      json<AiRuntimeConfigView>('/admin/operations/ai-runtime', { method: 'PUT', body: JSON.stringify(input) }),
    sourceOperations: (): Promise<SourceOperationsView> => json<SourceOperationsView>('/admin/operations/sources'),
    createSourceFeed: (input: CreateSourceFeedInput): Promise<SourceOperationsView> =>
      json<SourceOperationsView>('/admin/operations/sources', { method: 'POST', body: JSON.stringify(input) }),
    createSourceFeedsBulk: (input: BulkCreateSourceFeedsInput): Promise<BulkSourceImportResponse> =>
      json<BulkSourceImportResponse>('/admin/operations/sources/bulk', { method: 'POST', body: JSON.stringify(input) }),
    updateSourceFeed: (id: string, input: UpdateSourceFeedInput): Promise<SourceOperationsView> =>
      json<SourceOperationsView>(`/admin/operations/sources/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
    scanSourceFeed: (id: string): Promise<SourceOperationsView> =>
      json<SourceOperationsView>(`/admin/operations/sources/${id}/scan`, { method: 'POST' }),
  };
}
