import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubscriptionPlan } from '../database/entities/subscription-plans.entity';
import { SubscriptionPrice } from '../database/entities/subscription-prices.entity';
import {
  SubscriptionPlanDto,
  SubscriptionPriceDto,
  BillingCycleDto,
} from './dto/subscription-plan-response.dto';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(SubscriptionPlan)
    private readonly subscriptionPlanRepository: Repository<SubscriptionPlan>,
    @InjectRepository(SubscriptionPrice)
    private readonly subscriptionPriceRepository: Repository<SubscriptionPrice>,
  ) {}

  async getAvailablePlans(): Promise<SubscriptionPlanDto[]> {
    // Obtener todos los planes activos ordenados por sort_order
    const plans = await this.subscriptionPlanRepository.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC' },
    });

    // Para cada plan, obtener sus precios activos con sus billing cycles
    const plansWithPrices = await Promise.all(
      plans.map(async (plan) => {
        const prices = await this.subscriptionPriceRepository
          .createQueryBuilder('price')
          .leftJoinAndSelect('price.billingCycle', 'billingCycle')
          .where('price.plan_id = :planId', { planId: plan.id })
          .andWhere('price.is_active = :isActive', { isActive: true })
          .orderBy('billingCycle.slug', 'ASC')
          .getMany();

        const priceDtos: SubscriptionPriceDto[] = prices.map((price) => ({
          id: price.id,
          currency: price.currency,
          amount: parseFloat(price.amount.toString()),
          billingCycle: {
            id: price.billingCycle.id,
            name: price.billingCycle.name,
            slug: price.billingCycle.slug,
            intervalType: price.billingCycle.intervalType,
            intervalCount: price.billingCycle.intervalCount,
          } as BillingCycleDto,
        }));

        return {
          id: plan.id,
          name: plan.name,
          slug: plan.slug,
          description: plan.description || '',
          features: plan.features || [],
          prices: priceDtos,
        } as SubscriptionPlanDto;
      }),
    );

    return plansWithPrices;
  }
}

