import type { HealthResponse } from '@knowledge-map/contracts';
import { NextResponse } from 'next/server';

export function GET() {
  const health: HealthResponse = {
    service: 'web',
    status: 'ok',
    version: process.env.APP_VERSION ?? 'development',
    timestamp: new Date().toISOString(),
  };
  return NextResponse.json(health);
}
