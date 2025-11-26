import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionPlan } from '../database/entities/subscription-plans.entity';
import { SubscriptionPrice } from '../database/entities/subscription-prices.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SubscriptionPlan, SubscriptionPrice])],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}

