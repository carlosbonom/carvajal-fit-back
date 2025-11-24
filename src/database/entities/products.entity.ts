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
import { Creator } from './creators.entity';
import { ProductCategory } from './product-categories.entity';

export enum ProductType {
  PDF = 'pdf',
  DIGITAL_FILE = 'digital_file',
  VIDEO = 'video',
  EBOOK = 'ebook',
  TEMPLATE = 'template',
  OTHER = 'other',
}

@Entity('products')
@Check(`"product_type" IN ('pdf', 'digital_file', 'video', 'ebook', 'template', 'other')`)
@Index('idx_products_creator', ['creator'])
@Index('idx_products_category', ['category'])
@Index('idx_products_slug', ['slug'])
@Index('idx_products_type', ['productType'])
@Index('idx_products_active', ['isActive'])
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Creator, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'creator_id' })
  creator: Creator;

  @ManyToOne(() => ProductCategory, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'category_id' })
  category: ProductCategory;

  @Column({ type: 'varchar', length: 300, nullable: false })
  name: string;

  @Column({ type: 'varchar', length: 300, unique: true, nullable: false })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: false,
    name: 'product_type',
  })
  productType: ProductType;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'file_url' })
  fileUrl: string;

  @Column({ type: 'bigint', nullable: true, name: 'file_size_bytes' })
  fileSizeBytes: number;

  @Column({ type: 'varchar', length: 10, nullable: true, name: 'file_format' })
  fileFormat: string;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'thumbnail_url' })
  thumbnailUrl: string;

  @Column({ type: 'boolean', default: true, nullable: false, name: 'is_active' })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}

