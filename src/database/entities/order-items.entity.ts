import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Check,
  Index,
} from 'typeorm';
import { Order } from './orders.entity';
import { Product } from './products.entity';

@Entity('order_items')
@Check(`"quantity" > 0`)
@Index('idx_order_items_order', ['order'])
@Index('idx_order_items_product', ['product'])
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Order, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @ManyToOne(() => Product, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ type: 'varchar', length: 300, nullable: false, name: 'product_name' })
  productName: string;

  @Column({ type: 'varchar', length: 50, nullable: false, name: 'product_type' })
  productType: string;

  @Column({ type: 'integer', nullable: false, default: 1 })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false, name: 'unit_price' })
  unitPrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
  subtotal: number;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'file_url' })
  fileUrl: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}

