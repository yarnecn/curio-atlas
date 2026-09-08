import { Global, Inject, Injectable, Module, type OnApplicationShutdown } from '@nestjs/common';
import { closeDatabasePool, createDatabasePool, Phase1Repository, type Pool } from '@knowledge-map/database';

const DATABASE_POOL = Symbol('WORKER_DATABASE_POOL');

@Injectable()
class WorkerDatabaseLifecycle implements OnApplicationShutdown {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await closeDatabasePool(this.pool);
  }
}

@Global()
@Module({
  providers: [
    { provide: DATABASE_POOL, useFactory: (): Pool => createDatabasePool({ connectionLimit: 2 }) },
    {
      provide: Phase1Repository,
      inject: [DATABASE_POOL],
      useFactory: (pool: Pool): Phase1Repository => new Phase1Repository(pool),
    },
    WorkerDatabaseLifecycle,
  ],
  exports: [Phase1Repository],
})
export class WorkerDatabaseModule {}
