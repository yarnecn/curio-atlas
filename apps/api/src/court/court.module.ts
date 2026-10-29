import { Module } from '@nestjs/common';
import { CourtController } from './court.controller';

@Module({ controllers: [CourtController] })
export class CourtModule {}
