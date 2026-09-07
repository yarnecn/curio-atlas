import { Global, Inject, Injectable, Module, type OnApplicationShutdown } from '@nestjs/common';
import { closeDatabasePool, createDatabasePool, Phase1Repository, type Pool } from '@knowledge-map/database';

export const DATABASE_POOL = Symbol('DATABASE_POOL');

@Injectable()
class DatabaseLifecycle implements OnApplicationShutdown {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await closeDatabasePool(this.pool);
  }
}

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_POOL,
      useFactory: (): Pool => createDatabasePool(),
    },
    {
      provide: Phase1Repository,
      inject: [DATABASE_POOL],
      useFactory: (pool: Pool): Phase1Repository => new Phase1Repository(pool),
    },
    DatabaseLifecycle,
  ],
  exports: [DATABASE_POOL, Phase1Repository],
})
export class DatabaseModule {}
