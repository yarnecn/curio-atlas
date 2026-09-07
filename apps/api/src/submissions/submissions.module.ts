import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { CONTENT_AI_QUEUE } from '@knowledge-map/contracts';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService } from './submissions.service';

@Module({
  imports: [BullModule.registerQueue({ name: CONTENT_AI_QUEUE })],
  controllers: [SubmissionsController],
  providers: [SubmissionsService],
})
export class SubmissionsModule {}
