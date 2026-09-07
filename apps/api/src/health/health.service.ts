import { Injectable } from '@nestjs/common';
import type { HealthResponse } from '@knowledge-map/contracts';

@Injectable()
export class HealthService {
  getHealth(): HealthResponse {
    return {
      service: 'api',
      status: 'ok',
      version: process.env.APP_VERSION ?? '0.0.0',
      timestamp: new Date().toISOString(),
    };
  }
}
