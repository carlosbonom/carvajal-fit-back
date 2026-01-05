import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
    OneToMany,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Course } from './courses.entity';

@Entity('course_categories')
@Index('idx_course_categories_slug', ['slug'], { unique: true })
@Index('idx_course_categories_order', ['sortOrder'])
@Index('idx_course_categories_parent', ['parentId'])
export class CourseCategory {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 255, nullable: false, default: 'Nueva Categoría' })
    name: string;

    @Column({ type: 'varchar', length: 255, unique: false, nullable: true })
    @Index()
    slug: string | null;

    @Column({ type: 'text', nullable: true })
    description: string | null;

    @Column({ type: 'integer', default: 0, nullable: false, name: 'sort_order' })
    sortOrder: number;

    @Column({ type: 'boolean', default: true, nullable: false, name: 'is_active' })
    isActive: boolean;

    @Column({ type: 'uuid', nullable: true, name: 'parent_id' })
    parentId: string | null;

    @ManyToOne(() => CourseCategory, (category) => category.subcategories, {
        nullable: true,
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'parent_id' })
    parent: CourseCategory | null;

    @OneToMany(() => CourseCategory, (category) => category.parent)
    subcategories: CourseCategory[];

    @OneToMany(() => Course, (course) => course.category)
    courses: Course[];

    @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
    updatedAt: Date;
}
