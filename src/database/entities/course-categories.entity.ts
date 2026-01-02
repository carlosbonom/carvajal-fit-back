import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
    OneToMany,
} from 'typeorm';
import { Course } from './courses.entity';

@Entity('course_categories')
@Index('idx_course_categories_slug', ['slug'], { unique: true })
@Index('idx_course_categories_order', ['sortOrder'])
export class CourseCategory {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 255, nullable: false })
    name: string;

    @Column({ type: 'varchar', length: 255, unique: true, nullable: false })
    @Index()
    slug: string;

    @Column({ type: 'text', nullable: true })
    description: string | null;

    @Column({ type: 'integer', default: 0, nullable: false, name: 'sort_order' })
    sortOrder: number;

    @Column({ type: 'boolean', default: true, nullable: false, name: 'is_active' })
    isActive: boolean;

    @OneToMany(() => Course, (course) => course.category)
    courses: Course[];

    @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
    updatedAt: Date;
}
