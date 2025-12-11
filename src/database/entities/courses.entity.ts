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
import { Creator } from './creators.entity';

export enum CourseLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
}

@Entity('courses')
@Check(`"level" IN ('beginner', 'intermediate', 'advanced')`)
export class Course {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Creator, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'creator_id' })
  creator: Creator | null;

  @Column({ type: 'varchar', nullable: false })
  title: string;

  @Column({ type: 'varchar', unique: true, nullable: false })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'thumbnail_url' })
  thumbnailUrl: string;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'trailer_url' })
  trailerUrl: string;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  level: CourseLevel | null;

  @Column({ type: 'integer', nullable: true, name: 'duration_minutes' })
  durationMinutes: number | null;

  @Column({ type: 'boolean', default: false, nullable: false, name: 'is_published' })
  isPublished: boolean;

  @Column({ type: 'timestamptz', nullable: true, name: 'published_at' })
  publishedAt: Date | null;

  @Column({ type: 'integer', default: 0, nullable: false, name: 'sort_order' })
  sortOrder: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}

