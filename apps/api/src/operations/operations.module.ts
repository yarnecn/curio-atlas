import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SOURCE_MAINTENANCE_QUEUE } from '@knowledge-map/contracts';
import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';

@Module({
  imports: [BullModule.registerQueue({ name: SOURCE_MAINTENANCE_QUEUE })],
  controllers: [OperationsController],
  providers: [OperationsService],
})
export class OperationsModule {}
