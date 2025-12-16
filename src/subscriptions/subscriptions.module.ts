import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { MercadoPagoService } from './mercado-pago.service';
import { MercadoPagoCheckoutService } from './mercado-pago-checkout.service';
import { WebpayService } from './webpay.service';
import { PayPalService } from './paypal.service';
import { MarketingModule } from '../marketing/marketing.module';
import { LiorenModule } from '../lioren/lioren.module';
import { SubscriptionPlan } from '../database/entities/subscription-plans.entity';
import { SubscriptionPrice } from '../database/entities/subscription-prices.entity';
import { UserSubscription } from '../database/entities/user-subscriptions.entity';
import { BillingCycle } from '../database/entities/billing-cycles.entity';
import { SubscriptionPayment } from '../database/entities/subscription-payments.entity';
import { User } from '../database/entities/users.entity';
import { UserContentProgress } from '../database/entities/user-content-progress.entity';
import { Content } from '../database/entities/content.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SubscriptionPlan,
      SubscriptionPrice,
      UserSubscription,
      BillingCycle,
      SubscriptionPayment,
      User,
      UserContentProgress,
      Content,
    ]),
    MarketingModule,
    LiorenModule,
  ],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, MercadoPagoService, MercadoPagoCheckoutService, WebpayService, PayPalService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}

