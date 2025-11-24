import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from './users.entity';
import { Product } from './products.entity';
import { Order } from './orders.entity';

@Entity('user_product_purchases')
@Unique(['user', 'product', 'order'])
export class UserProductPurchase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Product, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @ManyToOne(() => Order, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({
    type: 'timestamptz',
    nullable: false,
    default: () => 'CURRENT_TIMESTAMP',
    name: 'purchased_at',
  })
  purchasedAt: Date;

  @Column({ type: 'integer', default: 0, nullable: false, name: 'download_count' })
  downloadCount: number;

  @Column({ type: 'timestamptz', nullable: true, name: 'last_download_at' })
  lastDownloadAt: Date;
}

