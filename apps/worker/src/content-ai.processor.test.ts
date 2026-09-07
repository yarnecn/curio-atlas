import { describe, expect, it } from 'vitest';
import { screenSubmission } from './content-ai.processor';
import { draftEvidence, runAiScreening } from './ai-adapter';

describe('submission screening placeholder', () => {
  it('normalizes whitespace and punctuation without inventing facts', () => {
    expect(screenSubmission({
      statement: '  GDP 不是生活质量的完整指标  ',
      source_url: 'https://www.stats.gov.cn/',
      experience_based: false,
    })).toEqual({
      refinedStatement: 'GDP 不是生活质量的完整指标。',
      riskFlags: [],
    });
  });

  it('holds unsupported absolute claims', () => {
    expect(screenSubmission({
      statement: '这个方法百分之百有效',
      source_url: null,
      experience_based: false,
    }).riskFlags).toEqual(['source_missing', 'absolute_or_high_risk_claim']);
  });

  it('detects question-style submissions before punctuation normalization', () => {
    expect(screenSubmission({
      statement: '为什么天空是蓝色的?',
      source_url: 'https://example.com/source',
      experience_based: false,
    })).toEqual({
      refinedStatement: '为什么天空是蓝色的?',
      riskFlags: ['question_style'],
    });
  });
});

describe('AI adapter routing', () => {
  it('uses the zero-token rules adapter by default', async () => {
    const result = await runAiScreening({
      provider: 'rules', model: 'deterministic-placeholder', baseUrl: null,
      maxInputChars: 12000, maxOutputTokens: 800, credentialConfigured: true, modeDescription: '',
    }, {
      statement: 'GDP 不能单独代表每个人的生活质量', why_useful: '避免误读总量指标。',
      applicability: '还要结合分配和价格。', source_url: 'https://example.com/source', experience_based: false,
    });
    expect(result).toMatchObject({ provider: 'rules', inputTokens: 0, outputTokens: 0 });
  });

  it('does not pretend rules mode can draft sourced knowledge', async () => {
    await expect(draftEvidence({
      provider: 'rules', model: 'deterministic-placeholder', baseUrl: null,
      maxInputChars: 12000, maxOutputTokens: 800, credentialConfigured: true, modeDescription: '',
    }, {
      topicName: '经济学基础', topicDescription: '基础概念', publisher: '测试机构',
      pageTitle: '测试资料', sourceUrl: 'https://example.com/source', evidenceText: '测试证据内容。',
    })).rejects.toThrow('规则模式只收集证据');
  });
});
