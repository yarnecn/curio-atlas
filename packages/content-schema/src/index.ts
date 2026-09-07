import { z } from 'zod';

const paragraphBlockSchema = z.object({
  type: z.literal('paragraph'),
  text: z.string().trim().min(8).max(500),
});

const headingBlockSchema = z.object({
  type: z.literal('heading'),
  level: z.union([z.literal(2), z.literal(3)]),
  text: z.string().trim().min(2).max(40),
});

const sourceBlockSchema = z.object({
  type: z.literal('source'),
  sourceId: z.string().min(1),
  note: z.string().optional(),
});

export const contentBlockSchema = z.discriminatedUnion('type', [
  paragraphBlockSchema,
  headingBlockSchema,
  sourceBlockSchema,
]);

export const knowledgeContentSchema = z.array(contentBlockSchema).superRefine((blocks, context) => {
  const paragraphs = blocks.filter((block) => block.type === 'paragraph');
  const textLength = paragraphs.reduce((total, block) => total + block.text.length, 0);
  if (paragraphs.length < 2 || textLength < 60) {
    context.addIssue({
      code: 'custom',
      message: '正式常识至少需要两个短段落，并完整说明核心结论和必要边界。',
    });
  }
  if (textLength > 900) {
    context.addIssue({ code: 'custom', message: '正式常识默认阅读时长不得超过约三分钟。' });
  }
  if (!blocks.some((block) => block.type === 'source')) {
    context.addIssue({ code: 'custom', message: '正式常识必须关联可核验来源。' });
  }
});

export type ContentBlock = z.infer<typeof contentBlockSchema>;
export type KnowledgeContent = z.infer<typeof knowledgeContentSchema>;

export const createSubmissionSchema = z.object({
  topicId: z.uuid(),
  statement: z.string().trim().min(12).max(160),
  whyUseful: z.string().trim().min(12).max(300),
  applicability: z.string().trim().min(8).max(300),
  sourceUrl: z.union([z.url(), z.literal('')]).optional(),
  experienceBased: z.boolean(),
  aiDisclosure: z.boolean(),
}).superRefine((value, context) => {
  if (!value.experienceBased && !value.sourceUrl) {
    context.addIssue({
      code: 'custom',
      message: '非个人经验内容必须提供可核验来源。',
      path: ['sourceUrl'],
    });
  }
});

export const createInternalCandidateSchema = z.object({
  topicId: z.uuid(),
  proposedTitle: z.string().trim().min(2).max(80),
  proposedSlug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  statement: z.string().trim().min(12).max(160),
  whyUseful: z.string().trim().min(12).max(300),
  applicability: z.string().trim().min(8).max(300),
  sourceUrl: z.url(),
  originType: z.enum(['source_discovery', 'coverage_gap', 'maintenance', 'admin_seed']),
  triggerReason: z.string().trim().min(4).max(500),
  aiDisclosure: z.boolean(),
});

export const voteSchema = z.object({
  value: z.enum(['useful', 'not_useful']),
});

export const reviewSubmissionSchema = z.object({
  decision: z.enum(['approve_new', 'merge', 'reject', 'hold']),
  reason: z.string().trim().min(2).max(500),
  title: z.string().trim().min(2).max(120).optional(),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120).optional(),
  targetKnowledgeNodeId: z.uuid().optional(),
}).superRefine((value, context) => {
  if (value.decision === 'approve_new' && (!value.title || !value.slug)) {
    context.addIssue({
      code: 'custom',
      message: '创建正式常识时必须填写标题和 slug。',
      path: ['title'],
    });
  }
  if (value.decision === 'merge' && !value.targetKnowledgeNodeId) {
    context.addIssue({
      code: 'custom',
      message: '合并时必须选择目标正式常识。',
      path: ['targetKnowledgeNodeId'],
    });
  }
});

export const rollbackKnowledgeSchema = z.object({
  targetRevisionId: z.uuid(),
  reason: z.string().trim().min(4).max(500),
});

const slugSchema = z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120);

const publicHandleSchema = z.string().trim().min(3).max(32)
  .regex(/^[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?$/, '账号只允许小写字母、数字、下划线和连字符。');

export const registerAccountSchema = z.object({
  publicHandle: publicHandleSchema,
  displayName: z.string().trim().min(2).max(40).optional(),
  password: z.string().min(10).max(128),
});

export const loginSchema = z.object({
  publicHandle: publicHandleSchema,
  password: z.string().min(1).max(128),
});

export const createKnowledgeDomainSchema = z.object({
  slug: slugSchema,
  name: z.string().trim().min(2).max(40),
  description: z.string().trim().max(200),
  sortOrder: z.number().int().min(0).max(10000),
});

export const updateKnowledgeDomainSchema = createKnowledgeDomainSchema.extend({
  isActive: z.boolean(),
});

export const createTopicSchema = z.object({
  domainId: z.uuid(),
  slug: slugSchema,
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300),
  sortOrder: z.number().int().min(0).max(10000),
  v1TargetCount: z.number().int().min(0).max(10000),
});

export const updateTopicSchema = createTopicSchema.extend({
  isActive: z.boolean(),
});

export const updateAiRuntimeConfigSchema = z.object({
  provider: z.enum(['rules', 'ollama', 'openai_compatible']),
  model: z.string().trim().min(1).max(120),
  baseUrl: z.union([z.url(), z.literal(''), z.null()]).optional(),
  maxInputChars: z.number().int().min(1000).max(100000),
  maxOutputTokens: z.number().int().min(100).max(8000),
}).superRefine((value, context) => {
  if (value.provider !== 'rules' && !value.baseUrl) {
    context.addIssue({ code: 'custom', path: ['baseUrl'], message: '启用模型时必须填写服务地址。' });
  }
  if (value.provider === 'openai_compatible' && value.baseUrl && !value.baseUrl.startsWith('https://')) {
    context.addIssue({ code: 'custom', path: ['baseUrl'], message: '远程兼容接口必须使用 HTTPS。' });
  }
});

export const createSourceFeedSchema = z.object({
  topicId: z.uuid(),
  name: z.string().trim().min(2).max(120),
  publisher: z.string().trim().min(2).max(120),
  url: z.url().refine((url) => url.startsWith('https://'), '来源地址必须使用 HTTPS。'),
  sourceType: z.enum(['official', 'research', 'open_education']),
  crawlMode: z.enum(['single_page', 'website']),
  maxPagesPerScan: z.number().int().min(1).max(20),
  autoScan: z.boolean(),
  license: z.string().trim().min(2).max(120),
  checkIntervalHours: z.number().int().min(1).max(8760),
}).superRefine((value, context) => {
  if (value.crawlMode === 'single_page' && value.maxPagesPerScan !== 1) {
    context.addIssue({ code: 'custom', path: ['maxPagesPerScan'], message: '单页模式每次只能抓取 1 页。' });
  }
});

export const updateSourceFeedSchema = createSourceFeedSchema.extend({ isActive: z.boolean() });
export const bulkCreateSourceFeedsSchema = z.object({ feeds: z.array(createSourceFeedSchema).min(1).max(200) });

export type CreateSubmission = z.infer<typeof createSubmissionSchema>;
export type CreateInternalCandidate = z.infer<typeof createInternalCandidateSchema>;
export type SubmissionVote = z.infer<typeof voteSchema>;
export type ReviewSubmission = z.infer<typeof reviewSubmissionSchema>;
export type RollbackKnowledge = z.infer<typeof rollbackKnowledgeSchema>;
export type RegisterAccount = z.infer<typeof registerAccountSchema>;
export type Login = z.infer<typeof loginSchema>;
export type CreateKnowledgeDomain = z.infer<typeof createKnowledgeDomainSchema>;
export type UpdateKnowledgeDomain = z.infer<typeof updateKnowledgeDomainSchema>;
export type CreateTopic = z.infer<typeof createTopicSchema>;
export type UpdateTopic = z.infer<typeof updateTopicSchema>;
export type UpdateAiRuntimeConfig = z.infer<typeof updateAiRuntimeConfigSchema>;
export type CreateSourceFeed = z.infer<typeof createSourceFeedSchema>;
export type UpdateSourceFeed = z.infer<typeof updateSourceFeedSchema>;
export type BulkCreateSourceFeeds = z.infer<typeof bulkCreateSourceFeedsSchema>;
