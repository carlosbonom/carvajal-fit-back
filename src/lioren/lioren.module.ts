import { Module } from '@nestjs/common';
import { LiorenService } from './lioren.service';

@Module({
  providers: [LiorenService],
  exports: [LiorenService],
})
export class LiorenModule {}

