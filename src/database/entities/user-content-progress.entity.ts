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
import { User } from './users.entity';
import { Content } from './content.entity';

@Entity('user_content_progress')
@Unique(['user', 'content'])
@Check(`"progress_seconds" >= 0`)
export class UserContentProgress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Content, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'content_id' })
  content: Content;

  @Column({
    type: 'integer',
    default: 0,
    nullable: false,
    name: 'progress_seconds',
  })
  progressSeconds: number;

  @Column({ type: 'boolean', default: false, nullable: false, name: 'is_completed' })
  isCompleted: boolean;

  @Column({ type: 'timestamptz', nullable: true, name: 'completed_at' })
  completedAt: Date;

  @Column({
    type: 'timestamptz',
    nullable: false,
    default: () => 'CURRENT_TIMESTAMP',
    name: 'last_watched_at',
  })
  lastWatchedAt: Date;

  @Column({ type: 'integer', default: 1, nullable: false, name: 'watch_count' })
  watchCount: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}

