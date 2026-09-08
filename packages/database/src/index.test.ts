import { describe, expect, it } from 'vitest';
import { DEFAULT_DATABASE_URL } from './client.js';
import { classifyKnowledgeCreator, nextStatusAfterAiScreening } from './phase1-repository.js';

describe('database defaults', () => {
  it('points at the local MySQL service', () => {
    expect(DEFAULT_DATABASE_URL).toContain('localhost:3306/knowledge_map');
  });
});

describe('AI screening destination', () => {
  it('sends a user submission into the public trial pool', () => {
    expect(nextStatusAfterAiScreening('user_submission', [])).toBe('trial');
  });

  it.each(['source_discovery', 'coverage_gap', 'maintenance', 'admin_seed'] as const)(
    'sends the %s internal candidate directly to human review',
    (originType) => {
      expect(nextStatusAfterAiScreening(originType, [])).toBe('queued_for_review');
    },
  );

  it('holds every origin when AI screening raises risk flags', () => {
    expect(nextStatusAfterAiScreening('coverage_gap', ['missing_source'])).toBe('held');
  });
});

describe('published knowledge creator labels', () => {
  it('labels legacy built-in content as system-curated', () => {
    expect(classifyKnowledgeCreator(null, null, null)).toEqual({
      kind: 'system', label: '系统整理', handle: null,
    });
  });

  it('labels crawled and maintained content as system-fetched', () => {
    expect(classifyKnowledgeCreator('source_discovery', 'owner', 'site-owner')).toEqual({
      kind: 'system', label: '系统抓取', handle: null,
    });
    expect(classifyKnowledgeCreator('maintenance', 'reviewer', 'editor')).toEqual({
      kind: 'system', label: '系统抓取', handle: null,
    });
  });

  it('separates owner-created content from other contributors', () => {
    expect(classifyKnowledgeCreator('admin_seed', 'owner', 'site-owner')).toEqual({
      kind: 'owner', label: '站长创建', handle: 'site-owner',
    });
    expect(classifyKnowledgeCreator('user_submission', 'user', 'reader-7')).toEqual({
      kind: 'contributor', label: '用户投稿', handle: 'reader-7',
    });
  });
});
