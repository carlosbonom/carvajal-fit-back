import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './users.entity';
import { Content } from './content.entity';

@Entity('comments')
@Index('idx_comments_content', ['content'])
@Index('idx_comments_user', ['user'])
@Index('idx_comments_parent', ['parent'])
export class Comment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Content, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'content_id' })
  content: Content;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'text', nullable: false })
  text: string;

  @ManyToOne(() => Comment, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parent_id' })
  parent: Comment | null;

  @OneToMany(() => Comment, (comment) => comment.parent, { cascade: true })
  replies: Comment[];

  @Column({ type: 'boolean', default: true, nullable: false, name: 'is_active' })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}

