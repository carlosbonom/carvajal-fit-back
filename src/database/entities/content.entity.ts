import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Unique,
  Check,
} from 'typeorm';
import { Course } from './courses.entity';
import { ContentResource } from './content-resources.entity';

export enum ContentType {
  VIDEO = 'video',
  IMAGE = 'image',
  PDF = 'pdf',
  DOCUMENT = 'document',
  AUDIO = 'audio',
  LINK = 'link',
  TEXT = 'text',
}

export enum AvailabilityType {
  NONE = 'none',
  MONTH = 'month',
  DAY = 'day',
  WEEK = 'week',
}

@Entity('content')
@Check(`"unlock_month" >= 1`)
@Check(`"content_type" IN ('video', 'image', 'pdf', 'document', 'audio', 'link', 'text')`)
@Check(`"availability_type" IN ('none', 'month', 'day', 'week')`)
export class Content {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Course, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'course_id' })
  course: Course;

  @Column({ type: 'varchar', nullable: false })
  title: string;

  @Column({ type: 'varchar', nullable: true })
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

  @Column({
    type: 'varchar',
    nullable: false,
    default: AvailabilityType.NONE,
    name: 'availability_type',
  })
  availabilityType: AvailabilityType;

  @OneToMany(() => ContentResource, (resource) => resource.content, {
    cascade: true,
  })
  resources: ContentResource[];

  @Column({ type: 'boolean', default: false, nullable: false, name: 'is_preview' })
  isPreview: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}

