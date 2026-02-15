import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual } from 'typeorm';
import { UserSubscription, SubscriptionStatus } from '../database/entities/user-subscriptions.entity';
import { Order, OrderStatus } from '../database/entities/orders.entity';
import { Product, ProductType } from '../database/entities/products.entity';
import { Content, ContentType } from '../database/entities/content.entity';
import { Course } from '../database/entities/courses.entity';
import { OrderItem } from '../database/entities/order-items.entity';

@Injectable()
export class DashboardService {
    constructor(
        @InjectRepository(UserSubscription)
        private userSubscriptionRepository: Repository<UserSubscription>,
        @InjectRepository(Order)
        private orderRepository: Repository<Order>,
        @InjectRepository(Product)
        private productRepository: Repository<Product>,
        @InjectRepository(Content)
        private contentRepository: Repository<Content>,
        @InjectRepository(Course)
        private courseRepository: Repository<Course>,
        @InjectRepository(OrderItem)
        private orderItemRepository: Repository<OrderItem>,
    ) { }

    async getGlobalStats() {
        console.log('[DashboardService] Getting global stats...');
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const startOfPreviousMonth = new Date(startOfMonth);
        startOfPreviousMonth.setMonth(startOfPreviousMonth.getMonth() - 1);

        // Subscriptions
        const activeSubscriptions = await this.userSubscriptionRepository.count({
            where: { status: SubscriptionStatus.ACTIVE },
        });

        const newMembersThisMonth = await this.userSubscriptionRepository.count({
            where: {
                createdAt: MoreThanOrEqual(startOfMonth),
            },
        });

        // Content
        const totalVideos = await this.contentRepository.count({
            where: { contentType: ContentType.VIDEO },
        });

        const totalCourses = await this.courseRepository.count();

        // Revenue (calculate from paid orders)
        // For simplicity, we'll sum orders with status COMPLETED
        const monthlyRevenueResult = await this.orderRepository
            .createQueryBuilder('order')
            .select('SUM(order.total)', 'total')
            .where('order.status = :status', { status: OrderStatus.COMPLETED })
            .andWhere('order.created_at >= :startOfMonth', { startOfMonth })
            .getRawOne();

        const previousMonthRevenueResult = await this.orderRepository
            .createQueryBuilder('order')
            .select('SUM(order.total)', 'total')
            .where('order.status = :status', { status: OrderStatus.COMPLETED })
            .andWhere('order.created_at >= :startOfPreviousMonth', { startOfPreviousMonth })
            .andWhere('order.created_at < :startOfMonth', { startOfMonth })
            .getRawOne();

        const monthlyRevenue = parseFloat(monthlyRevenueResult?.total || '0');
        const previousMonthRevenue = parseFloat(previousMonthRevenueResult?.total || '0');

        // Market Stats
        const marketJose = await this.getMarketStats('jose'); // Assuming slug is 'jose'
        const marketGabriel = await this.getMarketStats('gabriel'); // Assuming slug is 'gabriel'

        console.log('[DashboardService] Stats calculated successfully');
        return {
            activeSubscriptions,
            newMembersThisMonth,
            monthlyRevenue,
            monthlyRevenueGrowth: previousMonthRevenue > 0 ? ((monthlyRevenue - previousMonthRevenue) / previousMonthRevenue) * 100 : 0,
            totalVideos,
            totalCourses,
            marketJose,
            marketGabriel,
        };
    }

    async getMarketStats(creatorSlug: string) {
        // Products
        const products = await this.productRepository.find({
            where: { creator: { slug: creatorSlug } },
            relations: ['creator'],
        });

        const totalProducts = products.length;
        const pdfProducts = products.filter(p => p.productType === ProductType.PDF).length;
        const digitalProducts = products.filter(p => p.productType === ProductType.DIGITAL_FILE).length;
        const merchandiseProducts = products.filter(p => p.productType === ProductType.MERCHANDISE).length;

        // Sales & Revenue
        // We need to join OrderItems -> Product -> Creator
        const stats = await this.orderItemRepository
            .createQueryBuilder('item')
            .leftJoin('item.product', 'product')
            .leftJoin('product.creator', 'creator')
            .leftJoin('item.order', 'order') // Join order to check status
            .select('COUNT(item.id)', 'totalSales')
            .addSelect('SUM(item.subtotal)', 'totalRevenue')
            .where('creator.slug = :creatorSlug', { creatorSlug })
            .andWhere('order.status = :status', { status: OrderStatus.COMPLETED })
            .getRawOne();

        return {
            totalProducts,
            pdfProducts,
            digitalProducts,
            merchandiseProducts,
            totalSales: parseInt(stats?.totalSales || '0', 10),
            totalRevenue: parseFloat(stats?.totalRevenue || '0'),
        };
    }

    async getRecentActivity() {
        // Fetch recent subscriptions
        const recentSubs = await this.userSubscriptionRepository.find({
            take: 5,
            order: { createdAt: 'DESC' },
            relations: ['user', 'plan'],
        });

        // Fetch recent orders
        const recentOrders = await this.orderRepository.find({
            where: { status: OrderStatus.COMPLETED },
            take: 5,
            order: { createdAt: 'DESC' },
            relations: ['user'],
        });

        // Combine and sort
        const activity = [
            ...recentSubs.map(sub => ({
                id: `sub-${sub.id}`,
                type: 'subscription',
                message: `Nueva suscripción de ${sub.user.name || sub.user.email}`,
                date: sub.createdAt,
            })),
            ...recentOrders.map(order => ({
                id: `order-${order.id}`,
                type: 'sale',
                message: `Compra de ${order.user.name || order.user.email} ($${order.total})`,
                date: order.createdAt,
            }))
        ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 10);

        return activity;
    }

    async getReportsData() {
        const months = 6;
        const revenueData: { month: string; amount: number }[] = [];
        const subscriptionData: { month: string; new: number; cancelled: number }[] = [];
        const monthLabels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

        for (let i = months - 1; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            date.setDate(1);
            date.setHours(0, 0, 0, 0);

            const nextMonth = new Date(date);
            nextMonth.setMonth(nextMonth.getMonth() + 1);

            const monthName = monthLabels[date.getMonth()];

            // Revenue
            const revenueResult = await this.orderRepository
                .createQueryBuilder('order')
                .select('SUM(order.total)', 'total')
                .where('order.status = :status', { status: OrderStatus.COMPLETED })
                .andWhere('order.created_at >= :start', { start: date })
                .andWhere('order.created_at < :end', { end: nextMonth })
                .getRawOne();

            revenueData.push({
                month: monthName,
                amount: parseFloat(revenueResult?.total || '0'),
            });

            // Subscriptions - New
            const newSubs = await this.userSubscriptionRepository.count({
                where: {
                    startedAt: Between(date, nextMonth),
                },
            });

            // Subscriptions - Cancelled
            const cancelledSubs = await this.userSubscriptionRepository.count({
                where: {
                    cancelledAt: Between(date, nextMonth),
                },
            });

            subscriptionData.push({
                month: monthName,
                new: newSubs,
                cancelled: cancelledSubs,
            });
        }

        return {
            revenueData,
            subscriptionData,
        };
    }
}
