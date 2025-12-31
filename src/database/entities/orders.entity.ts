import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Check,
  Index,
} from 'typeorm';
import { User } from './users.entity';

export enum OrderStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  CANCELLED = 'cancelled',
}

@Entity('orders')
@Check(`"status" IN ('pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled')`)
@Index('idx_orders_user', ['user'])
@Index('idx_orders_number', ['orderNumber'])
@Index('idx_orders_status', ['status'])
@Index('idx_orders_created', ['createdAt'])
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 50, unique: true, nullable: false, name: 'order_number' })
  orderNumber: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: OrderStatus.PENDING,
    nullable: false,
  })
  status: OrderStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
  subtotal: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0.0, nullable: false })
  tax: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0.0, nullable: false })
  discount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
  total: number;

  @Column({ type: 'char', length: 3, nullable: false })
  currency: string;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'payment_method' })
  paymentMethod: string;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'payment_provider' })
  paymentProvider: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'transaction_id' })
  transactionId: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'billing_email' })
  billingEmail: string;

  @Column({ type: 'jsonb', nullable: true, name: 'billing_address' })
  billingAddress: Record<string, any>;

  @Column({ type: 'timestamptz', nullable: true, name: 'paid_at' })
  paidAt: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'completed_at' })
  completedAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}












