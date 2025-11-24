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
import { Course } from './courses.entity';

export enum ContentType {
  VIDEO = 'video',
  IMAGE = 'image',
  PDF = 'pdf',
  DOCUMENT = 'document',
  AUDIO = 'audio',
  LINK = 'link',
  TEXT = 'text',
}

@Entity('content')
@Unique(['course', 'slug'])
@Check(`"unlock_month" >= 1`)
@Check(`"content_type" IN ('video', 'image', 'pdf', 'document', 'audio', 'link', 'text')`)
export class Content {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Course, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'course_id' })
  course: Course;

  @Column({ type: 'varchar', nullable: false })
  title: string;

  @Column({ type: 'varchar', nullable: false })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'varchar',
    nullable: false,
    default: ContentType.VIDEO,
    name: 'content_type',
  })
  contentType: ContentType;

  @Column({
    type: 'integer',
    nullable: false,
    default: 1,
    name: 'unlock_month',
  })
  unlockMonth: number;

  @Column({ type: 'varchar', nullable: false, name: 'content_url' })
  contentUrl: string;

  @Column({ type: 'varchar', nullable: true, name: 'thumbnail_url' })
  thumbnailUrl: string;

  @Column({ type: 'integer', nullable: true, name: 'duration_seconds' })
  durationSeconds: number;

  @Column({ type: 'integer', default: 0, nullable: false, name: 'sort_order' })
  sortOrder: number;

  @Column({ type: 'boolean', default: false, nullable: false, name: 'has_resources' })
  hasResources: boolean;

  @Column({ type: 'varchar', nullable: true, name: 'resources_url' })
  resourcesUrl: string;

  @Column({ type: 'boolean', default: false, nullable: false, name: 'is_preview' })
  isPreview: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}

