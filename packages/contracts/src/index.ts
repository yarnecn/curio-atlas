export const PRODUCT_NAME = '常识地图';

export interface HealthResponse {
  service: 'api' | 'web';
  status: 'ok';
  version: string;
  timestamp: string;
}

export const SUBMISSION_STATUSES = [
  'submitted',
  'automated_screening',
  'trial',
  'expanded_trial',
  'queued_for_review',
  'merged',
  'rejected',
  'withdrawn',
  'held',
] as const;

export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];
export const SUBMISSION_ORIGIN_TYPES = [
  'user_submission',
  'source_discovery',
  'coverage_gap',
  'maintenance',
  'admin_seed',
] as const;

export type SubmissionOriginType = (typeof SUBMISSION_ORIGIN_TYPES)[number];
export type InternalCandidateOriginType = Exclude<SubmissionOriginType, 'user_submission'>;
export type VoteValue = 'useful' | 'not_useful';
export type ReviewDecision = 'approve_new' | 'merge' | 'reject' | 'hold';

export const CONTENT_AI_QUEUE = 'content-ai';
export const SCREEN_SUBMISSION_JOB = 'screen-submission';
export const SOURCE_MAINTENANCE_QUEUE = 'source-maintenance';
export const SCAN_SOURCES_JOB = 'scan-sources';

export type UserRole = 'user' | 'reviewer' | 'owner';

export interface AuthUserView {
  id: string;
  publicHandle: string;
  displayName: string;
  role: UserRole;
}

export interface AuthStateView {
  user: AuthUserView | null;
}

export interface RegisterAccountInput {
  publicHandle: string;
  displayName?: string;
  password: string;
}

export interface LoginInput {
  publicHandle: string;
  password: string;
}

export interface TopicSummary {
  id: string;
  slug: string;
  name: string;
  domainSlug: string;
  domainName: string;
  v1TargetCount: number;
}

export interface KnowledgeDomainAdminView {
  id: string;
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
  topicCount: number;
}

export interface TopicAdminView extends TopicSummary {
  domainId: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
  publishedCount: number;
  pendingCount: number;
}

export interface TaxonomyAdminView {
  domains: KnowledgeDomainAdminView[];
  topics: TopicAdminView[];
}

export interface CreateKnowledgeDomainInput {
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
}

export interface UpdateKnowledgeDomainInput extends CreateKnowledgeDomainInput {
  isActive: boolean;
}

export interface CreateTopicInput {
  domainId: string;
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
  v1TargetCount: number;
}

export interface UpdateTopicInput extends CreateTopicInput {
  isActive: boolean;
}

export const AI_PROVIDER_KINDS = ['rules', 'ollama', 'openai_compatible'] as const;
export type AiProviderKind = (typeof AI_PROVIDER_KINDS)[number];

export interface AiRuntimeConfigView {
  provider: AiProviderKind;
  model: string;
  baseUrl: string | null;
  maxInputChars: number;
  maxOutputTokens: number;
  credentialConfigured: boolean;
  modeDescription: string;
}

export interface UpdateAiRuntimeConfigInput {
  provider: AiProviderKind;
  model: string;
  baseUrl?: string | null;
  maxInputChars: number;
  maxOutputTokens: number;
}

export type ManagedSourceType = 'official' | 'research' | 'open_education';
export type SourceCrawlMode = 'single_page' | 'website';

export interface SourceFeedView {
  id: string;
  topicId: string;
  topicName: string;
  domainName: string;
  name: string;
  publisher: string;
  url: string;
  sourceType: ManagedSourceType;
  crawlMode: SourceCrawlMode;
  maxPagesPerScan: number;
  autoScan: boolean;
  license: string;
  isActive: boolean;
  checkIntervalHours: number;
  lastCheckedAt: string | null;
  nextCheckAt: string;
  lastError: string | null;
}

export interface CreateSourceFeedInput {
  topicId: string;
  name: string;
  publisher: string;
  url: string;
  sourceType: ManagedSourceType;
  crawlMode: SourceCrawlMode;
  maxPagesPerScan: number;
  autoScan: boolean;
  license: string;
  checkIntervalHours: number;
}

export interface UpdateSourceFeedInput extends CreateSourceFeedInput {
  isActive: boolean;
}

export interface BulkCreateSourceFeedsInput {
  feeds: CreateSourceFeedInput[];
}

export interface BulkSourceImportResponse extends SourceOperationsView {
  importedCount: number;
  skippedCount: number;
}

export interface EvidencePackageView {
  id: string;
  feedName: string;
  topicName: string;
  domainName: string;
  pageTitle: string;
  sourceUrl: string;
  evidenceText: string;
  discoveredUrls: string[];
  status: 'ready' | 'drafting' | 'candidate_created' | 'held' | 'dismissed';
  candidateSubmissionId: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface SourceOperationsView {
  automationEnabled: boolean;
  feeds: SourceFeedView[];
  evidence: EvidencePackageView[];
}

export interface SubmissionMetrics {
  usefulCount: number;
  notUsefulCount: number;
  validVoteCount: number;
  usefulnessRate: number;
}

export interface SubmissionView extends SubmissionMetrics {
  id: string;
  authorHandle: string;
  originType: SubmissionOriginType;
  triggerReason: string | null;
  proposedTitle: string | null;
  proposedSlug: string | null;
  topic: TopicSummary;
  status: SubmissionStatus;
  statement: string;
  displayStatement: string;
  whyUseful: string;
  applicability: string;
  sourceUrl: string | null;
  experienceBased: boolean;
  aiDisclosure: boolean;
  aiRiskFlags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateSubmissionInput {
  topicId: string;
  statement: string;
  whyUseful: string;
  applicability: string;
  sourceUrl?: string;
  experienceBased: boolean;
  aiDisclosure: boolean;
}

export interface CreateSubmissionResponse {
  submission: SubmissionView;
  aiJobId: string;
}

export interface CreateInternalCandidateInput {
  topicId: string;
  proposedTitle: string;
  proposedSlug: string;
  statement: string;
  whyUseful: string;
  applicability: string;
  sourceUrl: string;
  originType: InternalCandidateOriginType;
  triggerReason: string;
  aiDisclosure: boolean;
}

export interface VoteInput {
  value: VoteValue;
}

export interface ReviewSubmissionInput {
  decision: ReviewDecision;
  reason: string;
  title?: string;
  slug?: string;
  targetKnowledgeNodeId?: string;
}

export interface ReviewSubmissionResponse {
  submission: SubmissionView;
  knowledgeNodeId: string | null;
}

export interface KnowledgeNodeSummary {
  id: string;
  slug: string;
  title: string;
  summary: string;
  sections: KnowledgeContentSection[];
  readingTimeMinutes: number;
  topicId: string;
  topicName: string;
  domainSlug: string;
  domainName: string;
  publishedAt: string | null;
}

export const KNOWLEDGE_RELATION_TYPES = [
  'prerequisite_of', 'part_of', 'causes', 'influences', 'contrasts_with', 'located_in',
  'occurred_during', 'succeeded_by', 'explains', 'related_to',
] as const;
export type KnowledgeRelationType = (typeof KNOWLEDGE_RELATION_TYPES)[number];

export interface RelatedKnowledgeNode {
  id: string;
  slug: string;
  title: string;
  summary: string;
  topicName: string;
  domainName: string;
  relationType: KnowledgeRelationType;
  strength: number;
}

export interface KnowledgeNodeDetail extends KnowledgeNodeSummary {
  related: RelatedKnowledgeNode[];
}

export interface KnowledgeContentSection {
  heading: string | null;
  paragraphs: string[];
}

export interface KnowledgeRevisionSummary {
  id: string;
  knowledgeNodeId: string;
  version: number;
  changeSummary: string;
  reviewStatus: 'draft' | 'pending_review' | 'approved' | 'published' | 'superseded' | 'archived';
  aiInvolvement: 'none' | 'assisted' | 'generated';
  publishedAt: string | null;
  isCurrent: boolean;
}

export interface RollbackKnowledgeInput {
  targetRevisionId: string;
  reason: string;
}

export interface RollbackKnowledgeResponse {
  knowledgeNodeId: string;
  revision: KnowledgeRevisionSummary;
}
