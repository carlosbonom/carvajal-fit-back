import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Check,
} from 'typeorm';
import { SubscriptionPlan } from './subscription-plans.entity';
import { BillingCycle } from './billing-cycles.entity';

@Entity('subscription_prices')
@Unique(['plan', 'billingCycle', 'currency'])
@Check(`"amount" >= 0`)
export class SubscriptionPrice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => SubscriptionPlan, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'plan_id' })
  plan: SubscriptionPlan;

  @ManyToOne(() => BillingCycle, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'billing_cycle_id' })
  billingCycle: BillingCycle;

  @Column({ type: 'char', nullable: false })
  currency: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
  amount: number;

  @Column({ type: 'boolean', default: true, nullable: false, name: 'is_active' })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}

