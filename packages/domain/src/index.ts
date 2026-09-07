export const MASTERY_LEVELS = ['seen', 'recognized', 'explained', 'applied'] as const;

export type MasteryLevel = (typeof MASTERY_LEVELS)[number];

export interface SubmissionThresholds {
  expandedTrial: {
    minimumUseful: number;
    minimumNetUseful: number;
    minimumUsefulnessRate: number;
  };
  reviewQueue: {
    minimumValidVotes: number;
    minimumUsefulnessRate: number;
  };
}

export const SUBMISSION_THRESHOLDS: SubmissionThresholds = {
  expandedTrial: {
    minimumUseful: 5,
    minimumNetUseful: 4,
    minimumUsefulnessRate: 0.7,
  },
  reviewQueue: {
    minimumValidVotes: 20,
    minimumUsefulnessRate: 0.8,
  },
} as const;

export type CandidateStatus =
  | 'submitted'
  | 'automated_screening'
  | 'trial'
  | 'expanded_trial'
  | 'queued_for_review'
  | 'merged'
  | 'rejected'
  | 'withdrawn'
  | 'held';

export interface VoteMetrics {
  usefulCount: number;
  notUsefulCount: number;
  validVoteCount: number;
  usefulnessRate: number;
  netUseful: number;
}

export function calculateVoteMetrics(usefulCount: number, notUsefulCount: number): VoteMetrics {
  if (!Number.isInteger(usefulCount) || !Number.isInteger(notUsefulCount) || usefulCount < 0 || notUsefulCount < 0) {
    throw new Error('Vote counts must be non-negative integers.');
  }
  const validVoteCount = usefulCount + notUsefulCount;
  return {
    usefulCount,
    notUsefulCount,
    validVoteCount,
    usefulnessRate: validVoteCount === 0 ? 0 : usefulCount / validVoteCount,
    netUseful: usefulCount - notUsefulCount,
  };
}

export function statusForMetrics(
  metrics: VoteMetrics,
  thresholds: SubmissionThresholds = SUBMISSION_THRESHOLDS,
): 'trial' | 'expanded_trial' | 'queued_for_review' {
  if (
    metrics.validVoteCount >= thresholds.reviewQueue.minimumValidVotes
    && metrics.usefulnessRate >= thresholds.reviewQueue.minimumUsefulnessRate
  ) {
    return 'queued_for_review';
  }

  if (
    metrics.usefulCount >= thresholds.expandedTrial.minimumUseful
    && metrics.netUseful >= thresholds.expandedTrial.minimumNetUseful
    && metrics.usefulnessRate >= thresholds.expandedTrial.minimumUsefulnessRate
  ) {
    return 'expanded_trial';
  }

  return 'trial';
}

const allowedTransitions: Readonly<Record<CandidateStatus, readonly CandidateStatus[]>> = {
  submitted: ['automated_screening', 'withdrawn'],
  automated_screening: ['trial', 'queued_for_review', 'held', 'rejected', 'withdrawn'],
  trial: ['expanded_trial', 'queued_for_review', 'held', 'withdrawn'],
  expanded_trial: ['trial', 'queued_for_review', 'held', 'withdrawn'],
  queued_for_review: ['merged', 'rejected', 'held'],
  merged: [],
  rejected: [],
  withdrawn: [],
  held: ['automated_screening', 'trial', 'queued_for_review', 'rejected', 'withdrawn'],
};

export function assertSubmissionTransition(from: CandidateStatus, to: CandidateStatus): void {
  if (from === to) return;
  if (!allowedTransitions[from].includes(to)) {
    throw new Error(`Invalid submission transition: ${from} -> ${to}`);
  }
}

export function nextStatusAfterVote(
  current: CandidateStatus,
  metrics: VoteMetrics,
  thresholds: SubmissionThresholds = SUBMISSION_THRESHOLDS,
): CandidateStatus {
  if (current !== 'trial' && current !== 'expanded_trial') return current;
  const next = statusForMetrics(metrics, thresholds);
  assertSubmissionTransition(current, next);
  return next;
}
