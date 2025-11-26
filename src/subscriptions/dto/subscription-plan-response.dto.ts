export class BillingCycleDto {
  id: string;
  name: string;
  slug: string;
  intervalType: string;
  intervalCount: number;
}

export class SubscriptionPriceDto {
  id: string;
  currency: string;
  amount: number;
  billingCycle: BillingCycleDto;
}

export class SubscriptionPlanDto {
  id: string;
  name: string;
  slug: string;
  description: string;
  features: string[];
  prices: SubscriptionPriceDto[];
}

export class SubscriptionPlansResponseDto {
  plans: SubscriptionPlanDto[];
}

