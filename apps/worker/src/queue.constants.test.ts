import { describe, expect, it } from 'vitest';
import { STARTUP_HEALTH_JOB, SYSTEM_QUEUE } from './queue.constants';

describe('worker queue contract', () => {
  it('uses stable names', () => {
    expect({ queue: SYSTEM_QUEUE, job: STARTUP_HEALTH_JOB }).toEqual({
      queue: 'system',
      job: 'startup-health',
    });
  });
});

