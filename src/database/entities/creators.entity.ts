import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Check,
} from 'typeorm';

export enum CreatorStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

@Entity('creators')
@Check(`"status" IN ('active', 'inactive')`)
export class Creator {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: false })
  name: string;

  @Column({ type: 'varchar', unique: true, nullable: false })
  slug: string;

  @Column({ type: 'text', nullable: true })
  bio: string;

  @Column({ type: 'varchar', nullable: true, name: 'avatar_url' })
  avatarUrl: string;

  @Column({ type: 'varchar', nullable: true, name: 'website_url' })
  websiteUrl: string;

  @Column({ type: 'jsonb', nullable: true, name: 'social_links' })
  socialLinks: Record<string, string>;

  @Column({
    type: 'varchar',
    default: CreatorStatus.ACTIVE,
    nullable: false,
  })
  status: CreatorStatus;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}

