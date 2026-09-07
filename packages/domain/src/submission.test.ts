import { describe, expect, it } from 'vitest';
import {
  assertSubmissionTransition,
  calculateVoteMetrics,
  nextStatusAfterVote,
  statusForMetrics,
} from './index.js';

describe('submission voting rules', () => {
  it('keeps small samples in trial', () => {
    expect(statusForMetrics(calculateVoteMetrics(4, 0))).toBe('trial');
  });

  it('expands exposure only after all three thresholds pass', () => {
    expect(statusForMetrics(calculateVoteMetrics(5, 1))).toBe('expanded_trial');
    expect(statusForMetrics(calculateVoteMetrics(5, 2))).toBe('trial');
  });

  it('queues a candidate after enough valid ratings at 80 percent', () => {
    expect(statusForMetrics(calculateVoteMetrics(16, 4))).toBe('queued_for_review');
  });

  it('uses runtime policy thresholds when supplied by the repository', () => {
    expect(statusForMetrics(calculateVoteMetrics(8, 2), {
      expandedTrial: {
        minimumUseful: 3,
        minimumNetUseful: 2,
        minimumUsefulnessRate: 0.6,
      },
      reviewQueue: {
        minimumValidVotes: 10,
        minimumUsefulnessRate: 0.8,
      },
    })).toBe('queued_for_review');
  });

  it('does not change terminal or review states when votes are recalculated', () => {
    expect(nextStatusAfterVote('queued_for_review', calculateVoteMetrics(1, 20))).toBe('queued_for_review');
    expect(nextStatusAfterVote('merged', calculateVoteMetrics(20, 0))).toBe('merged');
  });

  it('rejects a direct automated-screening to published-equivalent transition', () => {
    expect(() => assertSubmissionTransition('automated_screening', 'merged')).toThrow(
      'Invalid submission transition',
    );
  });

  it('allows a screened internal candidate to enter human review without public voting', () => {
    expect(() => assertSubmissionTransition('automated_screening', 'queued_for_review')).not.toThrow();
  });
});
