import { describe, expect, it } from 'vitest';
import { HealthService } from './health.service';

describe('HealthService', () => {
  it('reports the API as healthy', () => {
    expect(new HealthService().getHealth()).toMatchObject({ service: 'api', status: 'ok' });
  });
});

