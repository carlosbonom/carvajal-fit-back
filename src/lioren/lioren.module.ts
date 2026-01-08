import { Module } from '@nestjs/common';
import { LiorenService } from './lioren.service';
import { LiorenController } from './lioren.controller';

@Module({
  controllers: [LiorenController],
  providers: [LiorenService],
  exports: [LiorenService],
})
export class LiorenModule { }






