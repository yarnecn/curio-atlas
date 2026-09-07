import { describe, expect, it } from 'vitest';
import { DEFAULT_DATABASE_URL } from './client.js';
import { nextStatusAfterAiScreening } from './phase1-repository.js';

describe('database defaults', () => {
  it('points at the local PostgreSQL service', () => {
    expect(DEFAULT_DATABASE_URL).toContain('localhost:5432/knowledge_map');
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
