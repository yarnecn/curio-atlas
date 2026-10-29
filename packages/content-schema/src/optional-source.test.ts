import { describe, expect, it } from 'vitest';
import { knowledgeContentSchema, createSubmissionSchema } from './index';

describe('optional reference sources', () => {
  it('accepts complete formal content without fabricating a source block', () => {
    const blocks = [
      { type: 'paragraph', text: '这是经过人工审核确认的核心结论，完整说明相关背景与含义，帮助读者理解具体内容。' },
      { type: 'paragraph', text: '这里进一步说明这个结论的用途和适用条件，提醒读者结合实际情况判断而不是盲目套用。' },
    ];
    expect(knowledgeContentSchema.parse(blocks)).toEqual(blocks);
  });
  it('still rejects malformed references when provided', () => {
    expect(createSubmissionSchema.safeParse({
      proposedTitle: '人口密度与生活质量',
      topicId: '20000000-0000-4000-8000-000000000001',
      statement: '人口密度不能单独代表生活质量。',
      whyUseful: '避免用一个指标替代复杂的生活条件。',
      experienceBased: false, aiDisclosure: false, sourceUrl: 'not-a-url',
    }).success).toBe(false);
  });
});
