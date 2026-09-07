import type { HealthResponse } from '@knowledge-map/contracts';
import { NextResponse } from 'next/server';

export function GET() {
  const health: HealthResponse = {
    service: 'web',
    status: 'ok',
    version: '0.0.0',
    timestamp: new Date().toISOString(),
  };
  return NextResponse.json(health);
}

