import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { STARTUP_HEALTH_JOB, SYSTEM_QUEUE } from './queue.constants';

@Injectable()
export class StartupHealthProducer implements OnApplicationBootstrap {
  constructor(@InjectQueue(SYSTEM_QUEUE) private readonly queue: Queue) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.queue.add(STARTUP_HEALTH_JOB, { source: 'worker-bootstrap' }, {
      removeOnComplete: true,
      removeOnFail: 100,
    });
  }
}

