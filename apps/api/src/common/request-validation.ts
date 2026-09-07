import { BadRequestException } from '@nestjs/common';

interface ValidationIssue {
  path: readonly PropertyKey[];
  message: string;
}

interface RuntimeSchema<T> {
  safeParse(value: unknown):
    | { success: true; data: T }
    | { success: false; error: { issues: readonly ValidationIssue[] } };
}

export function parseBody<T>(schema: RuntimeSchema<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new BadRequestException({
      message: '请求内容不符合规则。',
      issues: parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    });
  }
  return parsed.data;
}
