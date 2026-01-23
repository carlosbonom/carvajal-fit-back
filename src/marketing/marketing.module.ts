import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketingService } from './marketing.service';
import { MarketingController } from './marketing.controller';
import { EmailTemplate } from '../database/entities/email-template.entity';
import { UserSubscription } from '../database/entities/user-subscriptions.entity';
import { LiorenModule } from '../lioren/lioren.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([EmailTemplate, UserSubscription]),
    LiorenModule,
  ],
  controllers: [MarketingController],
  providers: [MarketingService],
  exports: [MarketingService],
})
export class MarketingModule { }


