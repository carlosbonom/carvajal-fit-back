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
import { UserSubscription } from './user-subscriptions.entity';
import { User } from './users.entity';

export enum PaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

@Entity('subscription_payments')
@Check(`"status" IN ('pending', 'completed', 'failed', 'refunded')`)
export class SubscriptionPayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => UserSubscription, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_subscription_id' })
  userSubscription: UserSubscription;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
  amount: number;

  @Column({ type: 'char', length: 3, nullable: false })
  currency: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: PaymentStatus.PENDING,
    nullable: false,
  })
  status: PaymentStatus;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'payment_method' })
  paymentMethod: string;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'payment_provider' })
  paymentProvider: string;

  @Column({ type: 'varchar', length: 255, unique: true, nullable: true, name: 'transaction_id' })
  transactionId: string;

  @Column({ type: 'timestamptz', nullable: false, name: 'period_start' })
  periodStart: Date;

  @Column({ type: 'timestamptz', nullable: false, name: 'period_end' })
  periodEnd: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'paid_at' })
  paidAt: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'refunded_at' })
  refundedAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}


