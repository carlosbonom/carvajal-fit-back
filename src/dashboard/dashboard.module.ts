import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DashboardGateway } from './dashboard.gateway';
import { UserSubscription } from '../database/entities/user-subscriptions.entity';
import { Order } from '../database/entities/orders.entity';
import { Product } from '../database/entities/products.entity';
import { Content } from '../database/entities/content.entity';
import { Course } from '../database/entities/courses.entity';
import { OrderItem } from '../database/entities/order-items.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            UserSubscription,
            Order,
            Product,
            Content,
            Course,
            OrderItem,
        ]),
    ],
    controllers: [DashboardController],
    providers: [DashboardService, DashboardGateway],
    exports: [DashboardGateway], // Export Gateway to use in other services
})
export class DashboardModule { }
