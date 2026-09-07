import { describe, expect, it } from 'vitest';
import {
  createInternalCandidateSchema,
  createSourceFeedSchema,
  createSubmissionSchema,
  knowledgeContentSchema,
  reviewSubmissionSchema,
  rollbackKnowledgeSchema,
  registerAccountSchema,
} from './index.js';

describe('knowledgeContentSchema', () => {
  it('accepts the minimal versioned content document', () => {
    expect(
      knowledgeContentSchema.parse([
        { type: 'heading', level: 2, text: '一句话解释' },
        { type: 'paragraph', text: '这是一个直接回答标题的可追溯知识说明，先给出核心答案，再补充读者需要知道的背景。' },
        { type: 'heading', level: 2, text: '为什么值得知道' },
        { type: 'paragraph', text: '它补充必要背景和使用边界，帮助读者形成闭环理解，并知道什么时候需要继续查证。' },
        { type: 'source', sourceId: 'source-1' },
      ]),
    ).toHaveLength(5);
  });

  it('rejects a definition that adds no usable explanation', () => {
    expect(knowledgeContentSchema.safeParse([
      { type: 'paragraph', text: '现代常用划分把世界海洋分为五大洋。' },
      { type: 'source', sourceId: 'source-1' },
    ]).success).toBe(false);
  });
});

describe('candidate submission schemas', () => {
  it('requires a source unless the author explicitly marks personal experience', () => {
    const base = {
      topicId: '20000000-0000-4000-8000-000000000001',
      statement: '人口密度不能单独代表生活质量。',
      whyUseful: '避免用一个指标替代复杂的生活条件。',
      applicability: '比较地区时还要结合资源和基础设施。',
      aiDisclosure: false,
    };
    expect(createSubmissionSchema.safeParse({ ...base, experienceBased: false }).success).toBe(false);
    expect(createSubmissionSchema.safeParse({ ...base, experienceBased: true }).success).toBe(true);
  });

  it('requires title and slug before creating formal knowledge', () => {
    expect(reviewSubmissionSchema.safeParse({ decision: 'approve_new', reason: '已核验。' }).success).toBe(false);
    expect(reviewSubmissionSchema.safeParse({
      decision: 'approve_new',
      reason: '已核验。',
      title: '人口密度',
      slug: 'population-density',
    }).success).toBe(true);
  });

  it('accepts only sourced, non-user internal editorial candidates', () => {
    const candidate = {
      topicId: '20000000-0000-4000-8000-000000000001',
      proposedTitle: '天气与气候',
      proposedSlug: 'weather-and-climate',
      statement: '天气描述短期大气状态，气候描述长期统计特征。',
      whyUseful: '区分两者有助于理解天气预报和长期气候资料。',
      applicability: '适用于基础地理和日常信息阅读。',
      sourceUrl: 'https://example.com/source',
      triggerReason: '常识覆盖地图发现基础概念缺口。',
      aiDisclosure: true,
    };
    expect(createInternalCandidateSchema.safeParse({ ...candidate, originType: 'coverage_gap' }).success).toBe(true);
    expect(createInternalCandidateSchema.safeParse({ ...candidate, originType: 'user_submission' }).success).toBe(false);
    expect(createInternalCandidateSchema.safeParse({ ...candidate, originType: 'coverage_gap', sourceUrl: '' }).success)
      .toBe(false);
  });

  it('requires a target version and a meaningful rollback reason', () => {
    const targetRevisionId = '40000000-0000-4000-8000-000000000001';
    expect(rollbackKnowledgeSchema.safeParse({ targetRevisionId, reason: '恢复上一版内容。' }).success).toBe(true);
    expect(rollbackKnowledgeSchema.safeParse({ targetRevisionId, reason: '短' }).success).toBe(false);
  });
});

describe('account schemas', () => {
  it('allows a pseudonymous account without real-name fields', () => {
    expect(registerAccountSchema.safeParse({ publicHandle: 'quiet_reader-7', password: 'a long passphrase' }).success).toBe(true);
  });

  it('rejects short passwords and unsafe handles', () => {
    expect(registerAccountSchema.safeParse({ publicHandle: '张三', password: 'a long passphrase' }).success).toBe(false);
    expect(registerAccountSchema.safeParse({ publicHandle: 'reader', password: 'short' }).success).toBe(false);
  });
});

describe('source crawl schemas', () => {
  const source = {
    topicId: '20000000-0000-4000-8000-000000000001',
    name: '官方资料', publisher: '测试机构', url: 'https://example.com/science/',
    sourceType: 'official', license: 'link_and_fact_reference_only', checkIntervalHours: 168,
  };

  it('accepts one manual page or a bounded website crawl', () => {
    expect(createSourceFeedSchema.safeParse({
      ...source, crawlMode: 'single_page', maxPagesPerScan: 1, autoScan: false,
    }).success).toBe(true);
    expect(createSourceFeedSchema.safeParse({
      ...source, crawlMode: 'website', maxPagesPerScan: 10, autoScan: true,
    }).success).toBe(true);
  });

  it('rejects an unbounded single-page source', () => {
    expect(createSourceFeedSchema.safeParse({
      ...source, crawlMode: 'single_page', maxPagesPerScan: 10, autoScan: false,
    }).success).toBe(false);
  });
});
