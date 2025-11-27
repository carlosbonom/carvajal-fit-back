import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Check,
} from 'typeorm';
import { User } from './users.entity';
import { SubscriptionPlan } from './subscription-plans.entity';
import { BillingCycle } from './billing-cycles.entity';

export enum SubscriptionStatus {
  ACTIVE = 'active',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
  PAUSED = 'paused',
  PAYMENT_FAILED = 'payment_failed',
}

@Entity('user_subscriptions')
@Check(`"status" IN ('active', 'cancelled', 'expired', 'paused', 'payment_failed')`)
export class UserSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => SubscriptionPlan, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'plan_id' })
  plan: SubscriptionPlan;

  @ManyToOne(() => BillingCycle, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'billing_cycle_id' })
  billingCycle: BillingCycle;

  @Column({
    type: 'varchar',
    default: SubscriptionStatus.ACTIVE,
    nullable: false,
  })
  status: SubscriptionStatus;

  @Column({
    type: 'timestamptz',
    nullable: false,
    default: () => 'CURRENT_TIMESTAMP',
    name: 'started_at',
  })
  startedAt: Date;

  @Column({ type: 'timestamptz', nullable: false, name: 'current_period_start' })
  currentPeriodStart: Date;

  @Column({ type: 'timestamptz', nullable: false, name: 'current_period_end' })
  currentPeriodEnd: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'cancelled_at' })
  cancelledAt: Date;

  @Column({
    type: 'integer',
    nullable: true,
    name: 'subscription_month',
  })
  subscriptionMonth: number | null;

  @Column({ type: 'boolean', default: true, nullable: false, name: 'auto_renew' })
  autoRenew: boolean;

  @Column({ type: 'text', nullable: true, name: 'cancellation_reason' })
  cancellationReason: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'mercado_pago_subscription_id' })
  mercadoPagoSubscriptionId: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}

