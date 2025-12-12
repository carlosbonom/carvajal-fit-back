import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Check,
} from 'typeorm';

export enum IntervalType {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
}

@Entity('billing_cycles')
@Check(`"interval_type" IN ('day', 'week', 'month', 'year')`)
export class BillingCycle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  name: string;

  @Column({ type: 'varchar', length: 50, unique: true, nullable: false })
  slug: string;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: false,
    name: 'interval_type',
  })
  intervalType: IntervalType;

  @Column({
    type: 'integer',
    nullable: false,
    default: 1,
    name: 'interval_count',
  })
  intervalCount: number;

  @Column({ type: 'boolean', default: true, nullable: false, name: 'is_active' })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}








