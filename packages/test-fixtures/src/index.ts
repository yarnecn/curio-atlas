import type { HealthResponse } from '@knowledge-map/contracts';

export function makeHealthFixture(overrides: Partial<HealthResponse> = {}): HealthResponse {
  return {
    service: 'api',
    status: 'ok',
    version: '0.0.0-test',
    timestamp: '2026-09-02T00:00:00.000Z',
    ...overrides,
  };
}

