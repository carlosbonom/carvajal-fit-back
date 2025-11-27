import { SubscriptionPlanDto } from './subscription-plan-response.dto';

export class BillingCycleInfoDto {
  id: string;
  name: string;
  slug: string;
  intervalType: string;
  intervalCount: number;
}

export class UserSubscriptionDto {
  id: string;
  status: string;
  startedAt: Date;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelledAt?: Date | null;
  autoRenew: boolean;
  cancellationReason?: string | null;
  mercadoPagoSubscriptionId?: string;
  plan: SubscriptionPlanDto;
  billingCycle: BillingCycleInfoDto;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

