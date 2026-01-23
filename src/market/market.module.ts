import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketController } from './market.controller';
import { MarketService } from './market.service';
import { PaymentsModule } from '../payments/payments.module';
import { MarketingModule } from '../marketing/marketing.module';
import { LiorenModule } from '../lioren/lioren.module';
import { Order } from '../database/entities/orders.entity';
import { Product } from '../database/entities/products.entity';
import { User } from '../database/entities/users.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Order,
            Product,
            User,
        ]),
        PaymentsModule,
        MarketingModule,
        LiorenModule,
    ],
    controllers: [MarketController],
    providers: [MarketService],
})
export class MarketModule { }
