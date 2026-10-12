import { describe, it, expect } from 'vitest';
import { createSubmissionSchema, candidateTitleSchema, candidateSummarySchema } from './index.js';

describe('candidate title and summary contract', () => {
  const input = { topicId: '20000000-0000-4000-8000-000000000001', proposedTitle: 'HTTPS 能保护什么？', statement: 'HTTPS 在正确建立加密连接后保护通信内容。', whyUseful: '帮助理解网络通信的安全边界，避免把加密等同于网站可信。', experienceBased: true, aiDisclosure: false };
  it('preserves a user supplied title', () => expect(createSubmissionSchema.parse(input).proposedTitle).toBe(input.proposedTitle));
  it('rejects missing titles from any API caller', () => expect(createSubmissionSchema.safeParse({ ...input, proposedTitle: undefined }).success).toBe(false));
  it('rejects blank and overlong titles', () => { for (const title of ['', ' ', 'a', 'a'.repeat(81)]) expect(candidateTitleSchema.safeParse(title).success).toBe(false); });
  it('requires a concise summary', () => { expect(candidateSummarySchema.safeParse('a'.repeat(161)).success).toBe(false); expect(candidateSummarySchema.safeParse('a'.repeat(12)).success).toBe(true); });
});
