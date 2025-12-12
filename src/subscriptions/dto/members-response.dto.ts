import { SubscriptionStatus } from '../../database/entities/user-subscriptions.entity';

export class MemberStatsDto {
  total: number;
  active: number;
  cancelled: number;
  monthlyRevenue: number;
}

export class MemberDto {
  id: string;
  name: string | null;
  email: string;
  subscription: {
    id: string;
    planName: string;
    status: SubscriptionStatus;
    startedAt: Date;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
  };
  progress: number; // Porcentaje de progreso (0-100)
  totalPaid: number; // Total pagado en la moneda del usuario
  currency: string;
}

export class MembersResponseDto {
  stats: MemberStatsDto;
  members: MemberDto[];
  total: number;
}

